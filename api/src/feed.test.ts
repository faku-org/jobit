import { afterEach, beforeEach, describe, expect, test, setSystemTime } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../data/test-feed");
mkdirSync(FIXTURES, { recursive: true });

const scraped = (id: string, date: string) => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: `Scrapeada ${id}`,
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
  apply_url: "https://ejemplo.com/1",
  duplicates: [],
});

const JOBS_FILE = join(FIXTURES, "jobs.json");
writeFileSync(
  JOBS_FILE,
  JSON.stringify({
    scraped_at: "2026-09-01T00:00:00.000Z",
    sources: ["buscojobs"],
    count: 3,
    jobs: [
      scraped("s1", "2026-09-03T00:00:00.000Z"),
      scraped("s2", "2026-09-01T00:00:00.000Z"),
      scraped("s3", "2026-08-20T00:00:00.000Z"),
    ],
  }),
  "utf8",
);

process.env.DB_FILE = ":memory:";
process.env.JOBS_FILE = JOBS_FILE;

const { closeDb } = await import("./db.ts");
const { clearCache } = await import("./store.ts");
const { clearFeedCache, loadFeed } = await import("./feed.ts");
const companies = await import("./companies.ts");
const offers = await import("./offers.ts");

beforeEach(() => {
  closeDb();
  clearCache();
  clearFeedCache();
});

function approvedCompany(): string {
  const created = companies.create({ name: "Acme", status: "approved" });
  if (!created.ok) throw new Error("no se creó");
  return created.value.id;
}

async function feed() {
  const result = await loadFeed();
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("loadFeed", () => {
  test("sin ofertas propias entrega el tablero scrapeado tal cual", async () => {
    const file = await feed();
    expect(file.jobs.map((job) => job.id)).toEqual(["s1", "s2", "s3"]);
    expect(file.sources).toEqual(["buscojobs"]);
  });

  test("intercala las propias por fecha, no las pega al final", async () => {
    const id = approvedCompany();
    const created = offers.create({ company_id: id, title: "Propia", status: "published" });
    if (!created.ok) throw new Error("no se creó");
    /* Entre s2 (1 set) y s3 (20 ago). */
    offers.update(created.value.id, {});
    const { db } = await import("./db.ts");
    db().run("UPDATE offers SET published_at = ? WHERE id = ?", [
      "2026-08-25T00:00:00.000Z",
      created.value.id,
    ]);
    clearFeedCache();

    const file = await feed();
    expect(file.jobs.map((job) => job.title)).toEqual([
      "Scrapeada s1",
      "Scrapeada s2",
      "Propia",
      "Scrapeada s3",
    ]);
  });

  test("una propia más nueva que todo va primera", async () => {
    offers.create({
      company_id: approvedCompany(),
      title: "Recién publicada",
      status: "published",
    });

    const file = await feed();
    expect(file.jobs[0]?.title).toBe("Recién publicada");
    expect(file.count).toBe(4);
  });

  test("suma la fuente propia solo cuando hay algo publicado", async () => {
    expect((await feed()).sources).toEqual(["buscojobs"]);

    offers.create({ company_id: approvedCompany(), title: "Propia", status: "published" });
    clearFeedCache();
    expect((await feed()).sources).toEqual(["buscojobs", "jobit"]);
  });

  test("un borrador no toca el feed", async () => {
    offers.create({ company_id: approvedCompany(), title: "Borrador", status: "draft" });
    expect((await feed()).jobs).toHaveLength(3);
  });

  test("publicar algo nuevo invalida el caché sin reiniciar nada", async () => {
    expect((await feed()).jobs).toHaveLength(3);

    offers.create({ company_id: approvedCompany(), title: "Propia", status: "published" });
    expect((await feed()).jobs).toHaveLength(4);
  });

  test("suspender la empresa la saca del feed en la siguiente lectura", async () => {
    const id = approvedCompany();
    offers.create({ company_id: id, title: "Propia", status: "published" });
    expect((await feed()).jobs).toHaveLength(4);

    /* Sin limpiar el caché a mano: el portón de moderación no puede depender
       de que algo más cambie para que la suspensión tenga efecto. */
    companies.update(id, { status: "suspended" });
    expect((await feed()).jobs).toHaveLength(3);
  });

  test("aprobar una empresa pendiente publica lo suyo sin tocar la oferta", async () => {
    const created = companies.create({ name: "Beta", status: "pending" });
    if (!created.ok) throw new Error("no se creó");
    offers.create({ company_id: created.value.id, title: "En espera", status: "published" });
    expect((await feed()).jobs).toHaveLength(3);

    companies.update(created.value.id, { status: "approved" });
    expect((await feed()).jobs).toHaveLength(4);
  });

  test("devuelve el mismo objeto mientras nada cambie", async () => {
    expect(await feed()).toBe(await feed());
  });
});

describe("cuando la base no está", () => {
  afterEach(() => {
    process.env.DB_FILE = ":memory:";
    closeDb();
    clearFeedCache();
  });

  /* Las propias son un agregado; el tablero es el producto. Antes de esto una
     base ilegible tiraba abajo /api/jobs, /api/meta y /api/market enteros, o
     sea toda la parte del sitio que le importa a alguien buscando trabajo. */
  test("sirve lo scrapeado en vez de tirar abajo el tablero", async () => {
    process.env.DB_FILE = join(FIXTURES, "no", "se", "puede", "jobit.db");
    closeDb();
    clearFeedCache();

    /* Un directorio donde el archivo no puede existir. */
    writeFileSync(join(FIXTURES, "no"), "no soy una carpeta", "utf8");

    const result = await loadFeed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.jobs).toHaveLength(3);
    expect(result.value.sources).toEqual(["buscojobs"]);
  });
});

describe("invalidación del caché", () => {
  afterEach(() => setSystemTime());

  /* Con el reloj quieto las dos escrituras comparten `updated_at` al
     milisegundo. Si la versión del caché se armara solo con esa marca, aprobar
     la empresa no invalidaría nada y la oferta quedaría afuera del tablero
     hasta que algo más cambiara. */
  test("aprobar en el mismo milisegundo en que se creó la empresa igual invalida", async () => {
    setSystemTime(new Date("2026-09-03T12:00:00.000Z"));

    const created = companies.create({ name: "Gamma", status: "pending" });
    if (!created.ok) throw new Error("no se creó");
    offers.create({ company_id: created.value.id, title: "Urgente", status: "published" });
    expect((await feed()).jobs).toHaveLength(3);

    companies.update(created.value.id, { status: "approved" });
    expect((await feed()).jobs).toHaveLength(4);
  });
});
