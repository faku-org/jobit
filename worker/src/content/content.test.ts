import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "../categories.ts";
import { collect, plainText } from "./adapters.ts";
import { SEED_ITEMS } from "./seed.ts";
import { contentId, isContentItem, type ContentSource } from "./types.ts";

const fixtureFetch = (body: string, type = "text/plain"): typeof fetch =>
  (async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": type },
    })) as unknown as typeof fetch;

const ctx = (fetchImpl: typeof fetch) => ({
  fetchImpl,
  now: "2026-09-01",
  userAgent: "jobit-test",
});

describe("contentId", () => {
  test("es estable y distingue urls", () => {
    expect(contentId("a", "https://x/y", "t")).toBe(contentId("a", "https://x/y", "t"));
    expect(contentId("a", "https://x/y", "t")).not.toBe(contentId("a", "https://x/z", "t"));
    expect(contentId("a", null, "uno")).not.toBe(contentId("a", null, "dos"));
  });
});

describe("plainText", () => {
  test("saca etiquetas, CDATA y entidades", () => {
    expect(plainText("<p>Hola &amp; chau</p>")).toBe("Hola & chau");
    expect(plainText("<![CDATA[<b>JS</b> básico]]>")).toBe("JS básico");
  });
});

describe("collect", () => {
  test("lee un feed RSS y un entry de Atom", async () => {
    const source: ContentSource = {
      id: "feed",
      label: "Feed de prueba",
      base: "https://example.test",
      kind: "resource",
      adapter: "rss",
      categories: ["tecnologia"],
      config: { feed: "https://example.test/rss", tag: "documentacion" },
    };
    const xml = `<rss><channel>
      <item><title>Curso de JS</title><link>https://example.test/js</link>
        <description><![CDATA[<p>Aprender <b>JS</b></p>]]></description></item>
      <entry><title>Guía SQL</title><link href="https://example.test/sql"/>
        <summary>Consultas básicas</summary></entry>
    </channel></rss>`;

    const items = await collect(source, ctx(fixtureFetch(xml, "application/rss+xml")));

    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe("Curso de JS");
    expect(items[0]?.body).toBe("Aprender JS");
    expect(items[0]?.url).toBe("https://example.test/js");
    expect(items[0]?.tags).toEqual(["documentacion"]);
    expect(items[1]?.title).toBe("Guía SQL");
    expect(items[1]?.url).toBe("https://example.test/sql");
  });

  test("lista enlaces de un sitemap y descarta lo ajeno o lo que no matchea", async () => {
    const source: ContentSource = {
      id: "docs",
      label: "Docs",
      base: "https://example.test",
      kind: "resource",
      adapter: "links",
      categories: ["tecnologia"],
      config: { page: "https://example.test/sitemap.xml", pattern: "/(js|sql)/" },
    };
    const xml = `<urlset>
      <url><loc>https://example.test/js/arrays</loc></url>
      <url><loc>https://example.test/sql/basics</loc></url>
      <url><loc>https://example.test/marketing/ads</loc></url>
      <url><loc>https://otro.example.test/js/intruso</loc></url>
    </urlset>`;

    const items = await collect(source, ctx(fixtureFetch(xml, "application/xml")));

    expect(items.map((item) => item.title).sort()).toEqual(["arrays", "basics"]);
    expect(items.every((item) => item.url?.startsWith("https://example.test"))).toBe(true);
  });

  test("mapea una respuesta JSON", async () => {
    const source: ContentSource = {
      id: "api",
      label: "API",
      base: "https://example.test",
      kind: "resource",
      adapter: "json",
      categories: ["datos-analisis"],
      config: { url: "https://example.test/api", items: "data.entries" },
    };
    const payload = JSON.stringify({
      data: {
        entries: [{ title: "Estadística", url: "https://example.test/e", description: "Curso" }],
      },
    });

    const items = await collect(source, ctx(fixtureFetch(payload, "application/json")));

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Estadística");
    expect(items[0]?.body).toBe("Curso");
  });

  test("una respuesta con error lanza, para que la ingesta conserve lo anterior", async () => {
    const source: ContentSource = {
      id: "roto",
      label: "Roto",
      base: "https://example.test",
      kind: "resource",
      adapter: "rss",
      categories: ["tecnologia"],
      config: { feed: "https://example.test/rss" },
    };
    const failure = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(collect(source, ctx(failure))).rejects.toThrow(/503/);
  });
});

describe("seed", () => {
  test("todas las filas son válidas y no se repiten", () => {
    expect(SEED_ITEMS.every(isContentItem)).toBe(true);
    const ids = SEED_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("tecnología tiene preguntas y ejercicios", () => {
    const tech = SEED_ITEMS.filter((item) => item.categories.includes("tecnologia"));
    expect(tech.some((item) => item.kind === "faq")).toBe(true);
    expect(tech.some((item) => item.kind === "exercise")).toBe(true);
  });

  test("cada rubro del catálogo tiene preguntas y temas", () => {
    const withoutFaq = CATEGORIES.filter(
      ({ slug }) =>
        !SEED_ITEMS.some((item) => item.kind === "faq" && item.categories.includes(slug)),
    ).map((category) => category.slug);
    const withoutTopic = CATEGORIES.filter(
      ({ slug }) =>
        !SEED_ITEMS.some((item) => item.kind === "topic" && item.categories.includes(slug)),
    ).map((category) => category.slug);

    expect(withoutFaq).toEqual([]);
    expect(withoutTopic).toEqual([]);
  });
});
