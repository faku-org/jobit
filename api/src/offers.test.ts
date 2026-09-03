import { beforeEach, describe, expect, test } from "bun:test";
import type { CompanyStatus } from "./companies.ts";

process.env.DB_FILE = ":memory:";

const { closeDb } = await import("./db.ts");
const companies = await import("./companies.ts");
const { OWN_SOURCE, create, counts, list, publishedJobs, remove, update } =
  await import("./offers.ts");

/** Una empresa lista para colgarle ofertas. */
function company(status: CompanyStatus = "approved"): string {
  const created = companies.create({ name: `Empresa ${crypto.randomUUID()}`, status });
  if (!created.ok) throw new Error("no se creó la empresa");
  return created.value.id;
}

beforeEach(closeDb);

describe("create", () => {
  test("nace en borrador", () => {
    const created = create({ company_id: company(), title: "Cajero" });
    expect(created.ok && created.value.status).toBe("draft");
  });

  test("necesita un título", () => {
    expect(create({ company_id: company(), title: "  " }).ok).toBe(false);
  });

  test("no se puede colgar de una empresa que no existe", () => {
    const created = create({ company_id: "no-existe", title: "Cajero" });
    expect(created.ok).toBe(false);
  });

  test("una categoría inventada cae en otros en vez de romper", () => {
    const created = create({ company_id: company(), title: "Cajero", category: "inventada" });
    expect(created.ok && created.value.category).toBe("otros");
  });

  test("toma una categoría del catálogo", () => {
    const created = create({ company_id: company(), title: "Enfermero", category: "salud" });
    expect(created.ok && created.value.category).toBe("salud");
  });

  test("rechaza un enlace de postulación que no sea http", () => {
    const created = create({
      company_id: company(),
      title: "Cajero",
      apply_url: "javascript:alert(1)",
    });
    expect(created.ok).toBe(false);
  });

  test("rechaza un sueldo mínimo mayor que el máximo", () => {
    const created = create({
      company_id: company(),
      title: "Cajero",
      salary_min: 90_000,
      salary_max: 50_000,
    });
    expect(created.ok).toBe(false);
  });

  test("rechaza una fecha de cierre que no sea AAAA-MM-DD", () => {
    expect(create({ company_id: company(), title: "X", closes_at: "el viernes" }).ok).toBe(false);
    expect(create({ company_id: company(), title: "X", closes_at: "2026-13-45" }).ok).toBe(false);
  });

  test("descarta un nivel que no existe sin tirar la oferta", () => {
    const created = create({ company_id: company(), title: "Cajero", level: "experto" });
    expect(created.ok && created.value.level).toBe("");
  });
});

describe("publicar", () => {
  test("publicar fija la fecha con la que entra al feed", () => {
    const created = create({ company_id: company(), title: "Cajero" });
    if (!created.ok) throw new Error("no se creó");
    expect(created.value.published_at).toBe("");

    const published = update(created.value.id, { status: "published" });
    expect(published.ok && published.value.published_at).not.toBe("");
  });

  test("archivar y volver a publicar no reescribe la fecha original", () => {
    const created = create({ company_id: company(), title: "Cajero", status: "published" });
    if (!created.ok) throw new Error("no se creó");
    const primera = created.value.published_at;

    update(created.value.id, { status: "archived" });
    const republicada = update(created.value.id, { status: "published" });
    expect(republicada.ok && republicada.value.published_at).toBe(primera);
  });
});

describe("publishedJobs: el portón de moderación", () => {
  test("una publicada de empresa aprobada sale al feed", () => {
    create({ company_id: company("approved"), title: "Cajero", status: "published" });
    expect(publishedJobs()).toHaveLength(1);
  });

  test("un borrador no sale, por más que la empresa esté aprobada", () => {
    create({ company_id: company("approved"), title: "Cajero", status: "draft" });
    expect(publishedJobs()).toHaveLength(0);
  });

  test("una archivada tampoco", () => {
    create({ company_id: company("approved"), title: "Cajero", status: "archived" });
    expect(publishedJobs()).toHaveLength(0);
  });

  test("publicada pero de empresa pendiente no sale", () => {
    create({ company_id: company("pending"), title: "Cajero", status: "published" });
    expect(publishedJobs()).toHaveLength(0);
  });

  test("suspender la empresa le saca las ofertas del feed sin tocarlas", () => {
    const id = company("approved");
    create({ company_id: id, title: "Cajero", status: "published" });
    expect(publishedJobs()).toHaveLength(1);

    companies.update(id, { status: "suspended" });
    expect(publishedJobs()).toHaveLength(0);
    /* Sigue publicada: lo que cambió es la empresa, no la oferta. */
    expect(list({ status: "published" })).toHaveLength(1);
  });

  test("vuelve al feed al reaprobar la empresa", () => {
    const id = company("approved");
    create({ company_id: id, title: "Cajero", status: "published" });
    companies.update(id, { status: "suspended" });
    companies.update(id, { status: "approved" });
    expect(publishedJobs()).toHaveLength(1);
  });
});

describe("publishedJobs: la forma de Job", () => {
  test("sale con la fuente propia y el nombre de la empresa", () => {
    const created = companies.create({ name: "Acme", status: "approved" });
    if (!created.ok) throw new Error("no se creó");
    create({ company_id: created.value.id, title: "Cajero", status: "published" });

    const job = publishedJobs()[0];
    expect(job?.source).toBe(OWN_SOURCE);
    expect(job?.company).toBe("Acme");
  });

  test("traduce la categoría a su etiqueta", () => {
    create({ company_id: company(), title: "Enfermero", category: "salud", status: "published" });
    expect(publishedJobs()[0]?.category_label).toBe("Salud");
  });

  test("los campos vacíos viajan como null, no como cadena vacía", () => {
    create({ company_id: company(), title: "Cajero", status: "published" });
    const job = publishedJobs()[0];

    expect(job?.department).toBeNull();
    expect(job?.city).toBeNull();
    expect(job?.level).toBeNull();
    expect(job?.remote).toBeNull();
    expect(job?.salary).toBeNull();
    expect(job?.closes_at).toBeNull();
  });

  test("el sueldo sale armado cuando hay al menos una punta", () => {
    create({ company_id: company(), title: "Cajero", salary_min: 45_000, status: "published" });
    expect(publishedJobs()[0]?.salary).toEqual({ min: 45_000, max: null, currency: "UYU" });
  });
});

describe("borrar", () => {
  test("borrar la empresa se lleva sus ofertas", () => {
    const id = company();
    create({ company_id: id, title: "Cajero", status: "published" });
    expect(list()).toHaveLength(1);

    companies.remove(id);
    expect(list()).toHaveLength(0);
  });

  test("borrar una oferta avisa si no había nada", () => {
    expect(remove("no-existe")).toBe(false);
  });

  test("cuenta por estado", () => {
    const id = company();
    create({ company_id: id, title: "A", status: "draft" });
    create({ company_id: id, title: "B", status: "published" });
    create({ company_id: id, title: "C", status: "published" });

    expect(counts()).toEqual({ draft: 1, published: 2, archived: 0 });
  });
});
