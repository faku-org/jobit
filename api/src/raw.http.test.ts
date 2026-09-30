import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../data/test-raw");
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

const handle = (path: string, headers?: Record<string, string>): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, { headers }));

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
      sources: ["buscojobs"],
      count: 1,
      jobs: [job],
    }),
    "utf8",
  );
});

describe("GET /api/jobs.txt", () => {
  test("el listado sale en texto, con los mismos filtros", async () => {
    const response = await handle("/api/jobs.txt?q=cajero");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const body = await response.text();
    expect(body.startsWith("JobIt 1-1 de 1\n")).toBe(true);
    expect(body).toContain("Cajero de mostrador");
    expect(body).toContain("https://ejemplo.com/a");
    expect(body).not.toContain("Atención al público");
  });

  test("curl sin Accept sigue recibiendo JSON en /api/jobs", async () => {
    const response = await handle("/api/jobs");
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    const body = (await response.json()) as { total: number };
    expect(body.total).toBe(1);
  });

  test("la misma URL con format=txt o Accept: text/plain también es texto", async () => {
    const byQuery = await handle("/api/jobs?format=txt");
    const byHeader = await handle("/api/jobs", { accept: "text/plain" });
    expect(await byQuery.text()).toBe(await byHeader.text());
    expect(byQuery.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });
});

describe("GET /api/jobs/:id", () => {
  test("en texto incluye la descripción", async () => {
    const response = await handle("/api/jobs/a?format=txt");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Atención al público.");
  });
});
