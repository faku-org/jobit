import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dir, "../../data/test-events.jsonl");
process.env.EVENTS_FILE = FILE;

const { appendEvents } = await import("./events.ts");

const rows = (): Record<string, unknown>[] =>
  readFileSync(FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

afterEach(() => rmSync(FILE, { force: true }));

const search = (over: Record<string, unknown> = {}) => ({
  kind: "search" as const,
  role: "cajero",
  category: "ventas",
  filters: ["q"],
  results: 12,
  ...over,
});

const apply = (over: Record<string, unknown> = {}) => ({
  kind: "apply" as const,
  job: "buscojobs:99",
  source: "buscojobs",
  category: "ventas",
  ...over,
});

describe("appendEvents", () => {
  test("escribe una línea por evento, con el día y sin la hora", async () => {
    await appendEvents([search(), apply()]);

    const written = rows();
    expect(written).toHaveLength(2);
    expect(written[0]?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(written)).not.toContain("T00:");
  });

  test("un lote vacío no toca el archivo", async () => {
    expect(await appendEvents([])).toBe(0);
  });
});

describe("recorte contra el vocabulario", () => {
  test("un puesto que no está en el catálogo entra como otro", async () => {
    await appendEvents([search({ role: "domador de leones" })]);
    expect(rows()[0]?.role).toBe("otro");
  });

  test("un puesto del catálogo pasa tal cual", async () => {
    await appendEvents([search({ role: "cajero" })]);
    expect(rows()[0]?.role).toBe("cajero");
  });

  test("una categoría inventada queda vacía en vez de guardarse", async () => {
    await appendEvents([search({ category: "lo que sea" })]);
    expect(rows()[0]?.category).toBe("");
  });

  test("descarta nombres de filtro que no existen y no repite", async () => {
    await appendEvents([search({ filters: ["q", "q", "password", "level"] })]);
    expect(rows()[0]?.filters).toEqual(["level", "q"]);
  });

  test("una fuente desconocida entra como otra", async () => {
    await appendEvents([apply({ source: "linkedin" })]);
    expect(rows()[0]?.source).toBe("otra");
  });

  /* El corazón de la promesa: si el navegador mandara texto libre igual, el
     archivo no lo guarda. */
  test("nada de lo que se manda como texto libre llega al archivo", async () => {
    await appendEvents([
      search({ role: "juan perez 099123456", category: "juan perez" }),
      apply({ source: "juan perez" }),
    ]);
    expect(readFileSync(FILE, "utf8")).not.toContain("juan");
  });
});

describe("el id de la oferta", () => {
  test("pasa el de una oferta scrapeada", async () => {
    await appendEvents([apply({ job: "uruguayconcursa:62-26" })]);
    expect(rows()[0]?.job).toBe("uruguayconcursa:62-26");
  });

  test("pasa el uuid de una oferta propia", async () => {
    const id = crypto.randomUUID();
    await appendEvents([apply({ job: id })]);
    expect(rows()[0]?.job).toBe(id);
  });

  test("tira el evento entero si el id tiene forma de otra cosa", async () => {
    expect(await appendEvents([apply({ job: "https://ejemplo.com/?a=b" })])).toBe(0);
  });

  test("tira el evento si el id viene con espacios", async () => {
    expect(await appendEvents([apply({ job: "juan perez" })])).toBe(0);
  });
});
