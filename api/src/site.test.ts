import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

process.env.DB_FILE = ":memory:";
process.env.PUBLIC_ORIGIN = "https://jobs.test";

const FIXTURES = join(import.meta.dir, "../../data/test-site");
mkdirSync(FIXTURES, { recursive: true });

const JOBS_FILE = join(FIXTURES, "jobs.json");
process.env.JOBS_FILE = JOBS_FILE;

writeFileSync(
  JOBS_FILE,
  JSON.stringify({
    scraped_at: "2026-09-01T00:00:00.000Z",
    sources: ["buscojobs"],
    count: 1,
    jobs: [
      {
        id: "s1",
        source: "buscojobs",
        source_id: "s1",
        title: "Cajero para supermercado",
        company: "Super",
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
        description: "Atender la caja.",
        requirements: null,
        apply_url: "https://ejemplo.com/aviso",
        duplicates: [],
      },
    ],
  }),
  "utf8",
);

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { clearFeedCache } = await import("./feed.ts");
const { app } = await import("./index.ts");

beforeEach(() => {
  closeDb();
  clearFeedCache();
  resetLimits();
});

const call = (path: string): Promise<Response> => app.handle(new Request(`http://localhost${path}`));

describe("páginas indexables", () => {
  test("la ficha de una oferta sale en HTML con su canonical", async () => {
    const response = await call("/empleo/s1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<h1>Cajero para supermercado</h1>");
    expect(html).toContain('rel="canonical" href="https://jobs.test/empleo/s1"');
  });

  test("una oferta que no está da 404 en HTML", async () => {
    const response = await call("/empleo/no-existe");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("No encontramos eso");
  });

  test("el mercado sale en HTML", async () => {
    const response = await call("/mercado");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("El mercado laboral uruguayo");
  });

  test("un rubro con ofertas sale, uno vacío da 404", async () => {
    expect((await call("/rubro/ventas")).status).toBe(200);
    expect((await call("/rubro/salud")).status).toBe(404);
  });

  test("un departamento con ofertas sale", async () => {
    const response = await call("/departamento/Montevideo");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Ofertas de trabajo en Montevideo");
  });
});
