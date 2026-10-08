import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_RANKING } from "./rank.ts";
import type { Job } from "./types.ts";

const FIXTURES = join(import.meta.dir, "../../data/test-feed");
mkdirSync(FIXTURES, { recursive: true });
const JOBS_FILE = join(FIXTURES, "search-jobs.json");

const job = (id: string, overrides: Partial<Job> = {}): Job => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: `Oferta ${id}`,
  company: "Empresa",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-01T00:00:00.000Z",
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "",
  requirements: null,
  apply_url: "https://ejemplo.com/1",
  duplicates: [],
  ...overrides,
});

const board: Job[] = [
  job("job-a", { title: "Diseño de producto", date_posted: "2026-09-03T00:00:00.000Z" }),
  job("job-b", {
    title: "Diseño gráfico",
    category: "logistica",
    category_label: "Logística y distribución",
    date_posted: "2026-09-02T00:00:00.000Z",
  }),
  job("job-c", {
    title: "Depósito",
    category: "logistica",
    category_label: "Logística y distribución",
    date_posted: "2026-09-01T00:00:00.000Z",
  }),
  job("job-d", { title: "Vendedor de salón", date_posted: "2026-08-31T00:00:00.000Z" }),
];

writeFileSync(
  JOBS_FILE,
  JSON.stringify({
    scraped_at: "2026-09-04T00:00:00.000Z",
    sources: ["buscojobs"],
    count: board.length,
    jobs: board,
  }),
);

process.env.DB_FILE = ":memory:";
process.env.JOBS_FILE = JOBS_FILE;

const { closeDb } = await import("./db.ts");
const { upsertEmbedding } = await import("./embeddings.ts");
const { clearFeedCache } = await import("./feed.ts");
const { resetLimits } = await import("./limit.ts");
const { clearCache: clearJobsCache } = await import("./store.ts");
const { cosineScores, normalizeScores, semanticOrder } = await import("./search.ts");
const { app } = await import("./index.ts");
const { startFakeEmbedder } = await import("./test/fake-embedder.ts");

let embedder: ReturnType<typeof startFakeEmbedder>;

beforeEach(() => {
  closeDb();
  clearJobsCache();
  clearFeedCache();
  resetLimits();
  process.env.JOBS_FILE = JOBS_FILE;
  delete process.env.EMBEDDER_BATCH;
  delete process.env.EMBEDDER_MODEL;

  /** La consulta se embebe siempre al mismo vector; los vectores guardados
   * son los que deciden el orden. */
  embedder = startFakeEmbedder({ vectorFor: () => [1, 0] });
  process.env.EMBEDDER_URL = embedder.url;

  upsertEmbedding("job-a", Float32Array.from([1, 0]), { model: "embeddinggemma-2" });
  upsertEmbedding("job-b", Float32Array.from([0.7, 0.7]), { model: "embeddinggemma-2" });
  upsertEmbedding("job-c", Float32Array.from([0, 1]), { model: "embeddinggemma-2" });
  /* job-d queda sin vector a propósito. */
});

afterEach(() => {
  embedder.stop();
});

const call = (path: string): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`));

interface Body {
  total: number;
  jobs: { id: string }[];
  error?: string;
}

describe("la ruta /api/search", () => {
  test("ordena por parecido y deja afuera lo que no tiene vector", async () => {
    const response = await call("/api/search?q=dise%C3%B1o");
    expect(response.status).toBe(200);

    const body = (await response.json()) as Body;
    expect(body.total).toBe(3);
    expect(body.jobs.map((entry) => entry.id)).toEqual(["job-a", "job-b", "job-c"]);
  });

  test("aplica los filtros del feed antes de ordenar", async () => {
    const response = await call("/api/search?q=dise%C3%B1o&category=logistica");
    const body = (await response.json()) as Body;

    expect(body.total).toBe(2);
    expect(body.jobs.map((entry) => entry.id)).toEqual(["job-b", "job-c"]);
  });

  test("sin texto de búsqueda responde 422", async () => {
    const response = await call("/api/search");
    expect(response.status).toBe(422);
    expect(((await response.json()) as Body).error ?? "").toContain("texto");
  });

  test("con el embedder caído responde 503 y no rompe el resto de la API", async () => {
    const down = startFakeEmbedder({});
    const url = down.url;
    down.stop();
    process.env.EMBEDDER_URL = url;

    expect((await call("/api/search?q=dise%C3%B1o")).status).toBe(503);
    expect((await call("/health")).status).toBe(200);
  });
});

describe("la ruta /api/offers/:id/similar", () => {
  test("devuelve las más parecidas a la oferta, sin repetirla", async () => {
    const response = await call("/api/offers/job-a/similar");
    expect(response.status).toBe(200);

    const body = (await response.json()) as Body;
    expect(body.total).toBe(2);
    expect(body.jobs.map((entry) => entry.id)).toEqual(["job-b", "job-c"]);
  });

  test("respeta limit", async () => {
    const body = (await (await call("/api/offers/job-a/similar?limit=1")).json()) as Body;
    expect(body.jobs.map((entry) => entry.id)).toEqual(["job-b"]);
  });

  test("una oferta que no está responde 404", async () => {
    expect((await call("/api/offers/no-existe/similar")).status).toBe(404);
  });

  test("una oferta sin vector todavía responde 404 con un motivo distinto", async () => {
    const response = await call("/api/offers/job-d/similar");
    expect(response.status).toBe(404);
    expect(((await response.json()) as Body).error ?? "").toContain("indexada");
  });
});

describe("el orden semántico", () => {
  const hits = [
    { job: job("alta"), score: 0.9 },
    { job: job("baja"), score: 0.1 },
  ];

  test("cosineScores solo puntúa lo que tiene vector", () => {
    const vectors = new Map<string, Float32Array>([
      ["job-a", Float32Array.from([1, 0])],
      ["job-c", Float32Array.from([0, 1])],
    ]);
    const scored = cosineScores(board, vectors, Float32Array.from([1, 0]));

    expect(scored.map((hit) => hit.job.id)).toEqual(["job-a", "job-c"]);
    expect(scored[0]?.score).toBeCloseTo(1, 6);
    expect(scored[1]?.score).toBeCloseTo(0, 6);
  });

  test("normalizeScores lleva todo a 0..1 y empata cuando son iguales", () => {
    expect(normalizeScores([2, 4, 6])).toEqual([0, 0.5, 1]);
    expect(normalizeScores([5, 5])).toEqual([1, 1]);
    expect(normalizeScores([])).toEqual([]);
  });

  test("sin ranking manda el coseno", () => {
    expect(semanticOrder(hits, undefined).map((hit) => hit.job.id)).toEqual(["alta", "baja"]);
  });

  test("con ranking y peso bajo, las preferencias dan vuelta el orden", () => {
    const ranking = { ...EMPTY_RANKING, categories: ["logistica"] };
    const preferred = semanticOrder(
      [
        { job: job("alta", { category: "ventas" }), score: 0.9 },
        { job: job("baja", { category: "logistica" }), score: 0.1 },
      ],
      ranking,
      0.3,
    );

    /** "alta" gana por coseno, pero 0.3 de peso no alcanza para tapar el rubro:
     * el score de rank.ts (42 puntos contra 0) la da vuelta. */
    expect(preferred[0]?.job.id).toBe("baja");
  });
});
