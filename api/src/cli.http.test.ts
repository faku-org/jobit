import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../data/test-cli");
mkdirSync(FIXTURES, { recursive: true });

const JOBS_FILE = join(FIXTURES, "jobs.json");

process.env.DB_FILE = ":memory:";
process.env.JOBS_FILE = JOBS_FILE;

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { clearCache } = await import("./store.ts");
const { clearFeedCache } = await import("./feed.ts");
const { app } = await import("./index.ts");

const job = {
  id: "a",
  source: "buscojobs",
  source_id: "a",
  title: "Cajero de mostrador",
  company: "Empresa SA",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-04T00:00:00.000Z",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: null,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "Atención al público.",
  requirements: null,
  apply_url: "https://ejemplo.com/a",
  duplicates: [],
};

const stateJob = {
  ...job,
  id: "b",
  source: "uruguayconcursa",
  source_id: "b",
  title: "Auxiliar administrativo",
  apply_url: "https://ejemplo.com/b",
  closes_at: "2026-09-20T00:00:00.000Z",
};

const handle = (path: string): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`));

beforeEach(() => {
  closeDb();
  resetLimits();
  clearCache();
  clearFeedCache();
  process.env.JOBS_FILE = JOBS_FILE;
  writeFileSync(
    JOBS_FILE,
    JSON.stringify({
      scraped_at: "2026-09-05T06:00:00.000Z",
      sources: ["buscojobs", "uruguayconcursa"],
      count: 2,
      jobs: [job, stateJob],
    }),
    "utf8",
  );
});

describe("GET /api/cli", () => {
  test("sin view es el mismo listado que /api/jobs.txt", async () => {
    const cli = await handle("/api/cli?q=cajero");
    const raw = await handle("/api/jobs.txt?q=cajero");
    expect(cli.status).toBe(200);
    expect(cli.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await cli.text()).toBe(await raw.text());
  });

  test("view=state es Uruguay Concursa, ordenado por cierre", async () => {
    const response = await handle("/api/cli?view=state");
    const body = await response.text();
    expect(body).toContain("Auxiliar administrativo");
    expect(body).not.toContain("Cajero de mostrador");
  });

  test("job= es la oferta con descripción", async () => {
    const response = await handle("/api/cli?job=a");
    const body = await response.text();
    expect(body).toContain("Cajero de mostrador");
    expect(body).toContain("Atención al público.");
  });

  test("embed= es el mismo atajo que job=", async () => {
    expect(await (await handle("/api/cli?embed=a")).text()).toBe(
      await (await handle("/api/cli?job=a")).text(),
    );
  });

  test("view=market es el informe, no las ofertas", async () => {
    const response = await handle("/api/cli?view=market");
    const body = await response.text();
    expect(body.startsWith("JobIt mercado · 2 ofertas · 2026-09-05\n")).toBe(true);
    expect(body).toContain("BuscoJobs");
    expect(body).toContain("/api/market.csv");
    expect(body).not.toContain("https://ejemplo.com/a");
  });

  test("guardadas explican que no hay nada en el servidor", async () => {
    const response = await handle("/api/cli?view=saved");
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("viven en el navegador");
    expect(body).not.toContain("Cajero de mostrador");
  });
});
