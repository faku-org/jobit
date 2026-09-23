import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../data/test-download");
mkdirSync(FIXTURES, { recursive: true });

const JOBS_FILE = join(FIXTURES, "jobs.json");

process.env.DB_FILE = ":memory:";
process.env.JOBS_FILE = JOBS_FILE;

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { clearCache } = await import("./store.ts");
const { clearFeedCache } = await import("./feed.ts");
const { app } = await import("./index.ts");

const SCRAPED_AT = "2026-09-05T06:00:00.000Z";

const job = (id: string) => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: "Vendedor de salón",
  company: "Empresa SA",
  department: "Salto, litoral",
  city: "Salto",
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
  description: "",
  requirements: null,
  apply_url: `https://ejemplo.com/${id}`,
  duplicates: [],
});

const get = (path: string): Promise<Response> => app.handle(new Request(`http://localhost${path}`));

beforeEach(() => {
  closeDb();
  resetLimits();
  clearCache();
  clearFeedCache();
  process.env.JOBS_FILE = JOBS_FILE;
  writeFileSync(
    JOBS_FILE,
    JSON.stringify({
      scraped_at: SCRAPED_AT,
      sources: ["buscojobs"],
      count: 2,
      jobs: [job("a"), job("b")],
    }),
    "utf8",
  );
});

describe("GET /api/market.csv", () => {
  test("baja como archivo fechado el día del scrape", async () => {
    const response = await get("/api/market.csv");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="jobit-mercado-2026-09-05.csv"',
    );
    /** Devolver un `Response` armado a mano no puede saltearse lo que la API le
     * pone a todo lo demás. */
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  /** `text()` se come el BOM al decodificar, así que se mira el cuerpo crudo:
   * es exactamente el byte que Excel necesita encontrar. */
  test("arranca con el BOM que Excel necesita y sigue con el encabezado", async () => {
    const bytes = new Uint8Array(await (await get("/api/market.csv")).arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const body = new TextDecoder().decode(bytes.subarray(3));
    expect(body.startsWith("tabla,clave,etiqueta,")).toBe(true);
    expect(body).toContain("total,total,Todo el país,,2,2,");
  });
});

describe("GET /api/market.xlsx", () => {
  test("baja como planilla y el cuerpo es un zip", async () => {
    const response = await get("/api/market.xlsx");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="jobit-mercado-2026-09-05.xlsx"',
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

describe("sin ofertas que resumir", () => {
  test("las dos descargas contestan lo mismo que el informe", async () => {
    process.env.JOBS_FILE = join(FIXTURES, "no-existe.json");
    clearCache();
    clearFeedCache();

    expect((await get("/api/market.csv")).status).toBe(503);
    expect((await get("/api/market.xlsx")).status).toBe(503);
  });
});
