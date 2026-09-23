import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../data/test-ingest");
mkdirSync(FIXTURES, { recursive: true });

const JOBS_FILE = join(FIXTURES, "jobs.json");

process.env.DB_FILE = ":memory:";
process.env.JOBS_FILE = JOBS_FILE;

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { clearCache, loadJobs } = await import("./store.ts");
const { clearFeedCache } = await import("./feed.ts");
const { app } = await import("./index.ts");

const TOKEN = "un-token-largo-y-aleatorio-de-verdad";

const job = (id: string, date: string) => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: `Oferta ${id}`,
  company: "Ajena",
  department: null,
  city: null,
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: date,
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
  apply_url: `https://ejemplo.com/${id}`,
  duplicates: [],
});

const payload = (scrapedAt: string, ids: string[]) => ({
  scraped_at: scrapedAt,
  sources: ["buscojobs"],
  count: ids.length,
  jobs: ids.map((id, index) => job(id, `2026-09-0${index + 1}T00:00:00.000Z`)),
});

/** Lo que deja el worker en producción: el mismo JSON, comprimido. */
const gzipped = (value: unknown): Uint8Array =>
  Bun.gzipSync(new TextEncoder().encode(JSON.stringify(value)));

function onDisk(scrapedAt: string, ids: string[]): void {
  writeFileSync(JOBS_FILE, JSON.stringify(payload(scrapedAt, ids)), "utf8");
  clearCache();
  clearFeedCache();
}

const post = (body: Uint8Array | string, token: string | null = TOKEN): Promise<Response> =>
  app.handle(
    new Request("http://localhost/api/ingest/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      },
      body,
    }),
  );

beforeEach(() => {
  closeDb();
  resetLimits();
  clearCache();
  clearFeedCache();
  process.env.INGEST_TOKEN = TOKEN;
  delete process.env.INGEST_TOKEN_FILE;
  onDisk("2026-09-01T00:00:00.000Z", ["viejo"]);
});

describe("con la ingesta apagada", () => {
  beforeEach(() => {
    delete process.env.INGEST_TOKEN;
  });

  test("la ruta ni existe, aunque venga con token", async () => {
    const response = await post(gzipped(payload("2026-09-05T00:00:00.000Z", ["a"])));
    expect(response.status).toBe(404);
  });
});

describe("token", () => {
  test("sin authorization no entra", async () => {
    const response = await post(gzipped(payload("2026-09-05T00:00:00.000Z", ["a"])), null);
    expect(response.status).toBe(401);
  });

  test("con otro token tampoco", async () => {
    const response = await post(
      gzipped(payload("2026-09-05T00:00:00.000Z", ["a"])),
      "un-token-largo-y-aleatorio-de-mentira",
    );
    expect(response.status).toBe(401);
  });

  test("un token que es prefijo del bueno no alcanza", async () => {
    const response = await post(gzipped(payload("2026-09-05T00:00:00.000Z", ["a"])), "un-token");
    expect(response.status).toBe(401);
  });

  test("el archivo del entorno gana sobre la variable", async () => {
    const path = join(FIXTURES, "token");
    writeFileSync(path, `  ${TOKEN}\n`, "utf8");
    process.env.INGEST_TOKEN_FILE = path;
    process.env.INGEST_TOKEN = "otro";

    const response = await post(gzipped(payload("2026-09-05T00:00:00.000Z", ["a"])));
    expect(response.status).toBe(200);
  });
});

describe("cuerpo", () => {
  test("escribe el archivo y lo deja servido sin reiniciar", async () => {
    const response = await post(gzipped(payload("2026-09-05T00:00:00.000Z", ["a", "b"])));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      count: 2,
      scraped_at: "2026-09-05T00:00:00.000Z",
      previous_count: 1,
    });

    const file = await loadJobs();
    expect(file.ok && file.value.jobs.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  test("también acepta el JSON sin comprimir", async () => {
    const response = await post(JSON.stringify(payload("2026-09-05T00:00:00.000Z", ["a"])));
    expect(response.status).toBe(200);

    const file = await loadJobs();
    expect(file.ok && file.value.count).toBe(1);
  });

  test("un cuerpo que no es JSON no toca nada", async () => {
    const response = await post("no soy json");
    expect(response.status).toBe(422);

    const file = await loadJobs();
    expect(file.ok && file.value.jobs.map((entry) => entry.id)).toEqual(["viejo"]);
  });

  test("un archivo sin ofertas no borra el tablero", async () => {
    const response = await post(gzipped(payload("2026-09-05T00:00:00.000Z", [])));
    expect(response.status).toBe(422);

    const file = await loadJobs();
    expect(file.ok && file.value.count).toBe(1);
  });

  test("un objeto sin la lista de ofertas se rechaza", async () => {
    const response = await post(gzipped({ scraped_at: "2026-09-05T00:00:00.000Z" }));
    expect(response.status).toBe(422);
  });

  test("un archivo más viejo que el que está no lo pisa", async () => {
    onDisk("2026-09-05T00:00:00.000Z", ["nuevo"]);

    const response = await post(gzipped(payload("2026-09-01T00:00:00.000Z", ["a", "b"])));
    expect(response.status).toBe(409);

    const file = await loadJobs();
    expect(file.ok && file.value.jobs.map((entry) => entry.id)).toEqual(["nuevo"]);
  });

  test("volver a subir el mismo archivo es idempotente", async () => {
    const body = payload("2026-09-05T00:00:00.000Z", ["a"]);
    expect((await post(gzipped(body))).status).toBe(200);
    expect((await post(gzipped(body))).status).toBe(200);

    const file = await loadJobs();
    expect(file.ok && file.value.count).toBe(1);
  });
});
