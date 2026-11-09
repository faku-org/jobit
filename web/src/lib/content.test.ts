import { describe, expect, test } from "bun:test";
import { contentQuery, externalRel, fetchContent, roleGuideHref } from "./content.ts";

describe("contentQuery", () => {
  test("arma los parámetros con tipos, rubro y paginado", () => {
    const query = contentQuery({
      kinds: ["faq", "exercise"],
      category: "tecnologia",
      limit: 5,
      offset: 10,
    });
    const params = new URLSearchParams(query);
    expect(params.get("kind")).toBe("faq,exercise");
    expect(params.get("category")).toBe("tecnologia");
    expect(params.get("limit")).toBe("5");
    expect(params.get("offset")).toBe("10");
  });

  test("usa el tope por defecto y omite lo vacío", () => {
    const params = new URLSearchParams(contentQuery({ category: "" }));
    expect(params.get("limit")).toBe("12");
    expect(params.has("category")).toBe(false);
    expect(params.has("kind")).toBe(false);
  });
});

describe("externalRel", () => {
  test("marca sponsored solo cuando corresponde", () => {
    expect(externalRel(true)).toContain("sponsored");
    expect(externalRel(false)).not.toContain("sponsored");
    expect(externalRel(false)).toContain("noopener");
  });
});

describe("fetchContent", () => {
  test("pide /api/content con la query armada", async () => {
    const original = globalThis.fetch;
    let seen = "";
    globalThis.fetch = (async (input: string | URL | Request) => {
      seen = String(input);
      return new Response(JSON.stringify({ total: 0, offset: 0, limit: 12, items: [] }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const page = await fetchContent({ kinds: ["faq"], category: "ventas" });
      expect(page.total).toBe(0);
      expect(seen).toContain("/api/content?");
      expect(seen).toContain("category=ventas");
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("scope y guía de puesto", () => {
  test("el scope viaja en la query solo cuando se pide", () => {
    expect(
      new URLSearchParams(contentQuery({ category: "ventas", scope: "rubro" })).get("scope"),
    ).toBe("rubro");
    expect(new URLSearchParams(contentQuery({ category: "ventas" })).has("scope")).toBe(false);
  });

  test("roleGuideHref arma la dirección con el rubro del contenido", () => {
    const item = (roles: string[], categories: string[]) =>
      ({ roles, categories }) as Parameters<typeof roleGuideHref>[1][number];

    expect(roleGuideHref("cajero", [item(["cajero"], ["ventas"])])).toBe(
      "/entrevista/ventas/cajero",
    );
  });

  test("sin contenido de ese puesto no hay enlace", () => {
    const other = { roles: ["vendedor"], categories: ["ventas"] } as Parameters<
      typeof roleGuideHref
    >[1][number];
    expect(roleGuideHref("cajero", [])).toBeNull();
    expect(roleGuideHref("cajero", [other])).toBeNull();
  });
});
