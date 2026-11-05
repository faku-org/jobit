import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentId, type ContentItem } from "@jobit/worker/content/types";
import {
  clearContentCache,
  loadContent,
  mergeContent,
  parseContentFile,
  queryContent,
} from "./content.ts";

const item = (overrides: Partial<ContentItem> = {}): ContentItem => {
  const title = overrides.title ?? "Pregunta";
  return {
    id: contentId("test", null, title),
    kind: "faq",
    title,
    body: "Respuesta",
    url: null,
    source: "test",
    source_label: "Test",
    license: null,
    sponsored: false,
    categories: ["tecnologia"],
    roles: [],
    level: null,
    tags: [],
    fetched_at: "2026-09-01",
    ...overrides,
  };
};

describe("parseContentFile", () => {
  test("acepta un archivo con items válidos", () => {
    const parsed = parseContentFile({ fetched_at: "2026-09-01", items: [item()] });
    expect(parsed.ok).toBe(true);
  });

  test("rechaza un archivo sin items", () => {
    expect(parseContentFile({ items: [{ title: "sin id" }] }).ok).toBe(false);
    expect(parseContentFile(null).ok).toBe(false);
  });
});

describe("mergeContent", () => {
  test("deduplica por id y deja ganar a lo último", () => {
    const first = item({ title: "Igual", body: "viejo" });
    const second = { ...first, body: "nuevo" };
    const merged = mergeContent([first], [second]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.body).toBe("nuevo");
  });
});

describe("queryContent", () => {
  const items = [
    item({ title: "¿Qué es una API?", kind: "faq", categories: ["tecnologia"] }),
    item({ title: "Invertir una cadena", kind: "exercise", categories: ["tecnologia"] }),
    item({ title: "Manejo de objeciones", kind: "faq", categories: ["ventas"] }),
    item({ title: "Cerrar el mes", kind: "faq", categories: ["contabilidad-finanzas"] }),
  ];

  test("filtra por rubro y por tipo", () => {
    const page = queryContent(items, {
      kinds: new Set(["faq", "exercise"]),
      category: "tecnologia",
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(2);
    expect(page.items.every((entry) => entry.categories.includes("tecnologia"))).toBe(true);
  });

  test("ordena las preguntas antes que los ejercicios", () => {
    const page = queryContent(items, { category: "tecnologia", limit: 20, offset: 0 });
    expect(page.items.map((entry) => entry.kind)).toEqual(["faq", "exercise"]);
  });

  test("busca en título y cuerpo y pagina", () => {
    const found = queryContent(items, { q: "api", limit: 20, offset: 0 });
    expect(found.total).toBe(1);
    expect(found.items[0]?.title).toBe("¿Qué es una API?");

    const first = queryContent(items, { category: "tecnologia", limit: 1, offset: 0 });
    const second = queryContent(items, { category: "tecnologia", limit: 1, offset: 1 });
    expect(first.items[0]?.id).not.toBe(second.items[0]?.id);
  });
});

describe("loadContent", () => {
  test("sin archivo traído, sirve el seed", async () => {
    process.env.CONTENT_FILE = join(tmpdir(), "jobit-content-que-no-existe.json");
    clearContentCache();
    const result = await loadContent();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value.some((entry) => entry.source === "jobit")).toBe(true);
    }
  });

  test("mezcla el archivo traído con el seed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jobit-content-"));
    const path = join(dir, "content.json");
    const fetched = item({ title: "Traído", source: "w3schools", source_label: "W3Schools" });
    await Bun.write(path, JSON.stringify({ fetched_at: "2026-09-02", items: [fetched] }));

    process.env.CONTENT_FILE = path;
    clearContentCache();
    try {
      const result = await loadContent();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.some((entry) => entry.title === "Traído")).toBe(true);
        expect(result.value.some((entry) => entry.source === "jobit")).toBe(true);
      }
    } finally {
      delete process.env.CONTENT_FILE;
      clearContentCache();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
