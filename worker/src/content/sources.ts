import type { ContentSource } from "./types.ts";

/**
 * Las fuentes base del contenido.
 *
 * Cada una se declara con su URL base, el adapter que la sabe leer y a qué
 * rubros (y puestos) aplica lo que trae. Es el punto de entrada para sumar una
 * fuente: se agrega acá una entrada y la ingesta la levanta sola.
 *
 * Correr la ingesta es una decisión del operador, no del build: cada fuente
 * tiene sus términos de uso y su robots.txt, y hay que respetarlos. Por eso el
 * seed vive aparte y el sistema funciona sin ejecutar una sola petición.
 */
export const CONTENT_SOURCES: ContentSource[] = [
  {
    id: "mdn",
    label: "MDN Web Docs",
    base: "https://developer.mozilla.org",
    kind: "resource",
    adapter: "rss",
    categories: ["tecnologia"],
    license: "CC BY-SA 2.5",
    config: { feed: "https://developer.mozilla.org/en-US/blog/rss.xml", tag: "documentacion" },
  },
  {
    id: "w3schools",
    label: "W3Schools",
    base: "https://www.w3schools.com",
    kind: "resource",
    adapter: "links",
    categories: ["tecnologia", "datos-analisis"],
    license: "© W3Schools",
    config: {
      page: "https://www.w3schools.com/sitemap.xml",
      pattern: "/(js|sql|python|html|css)/",
      tag: "documentacion",
      limit: "30",
    },
  },
  {
    id: "freecodecamp",
    label: "freeCodeCamp",
    base: "https://www.freecodecamp.org",
    kind: "exercise",
    adapter: "rss",
    categories: ["tecnologia"],
    license: "CC BY-SA 4.0",
    config: { feed: "https://www.freecodecamp.org/news/rss/", tag: "practica" },
  },
];
