import { describe, expect, test } from "bun:test";
import { buildHash, compareManifests, identical } from "./manifest.ts";

describe("buildHash", () => {
  test("no depende del orden en que se listan los archivos", () => {
    expect(buildHash({ "a.js": "1", "b.js": "2" })).toBe(buildHash({ "b.js": "2", "a.js": "1" }));
  });

  test("cambia si cambia un solo archivo", () => {
    expect(buildHash({ "a.js": "1", "b.js": "2" })).not.toBe(
      buildHash({ "a.js": "1", "b.js": "3" }),
    );
  });

  test("cambia si un archivo cambia de nombre con el mismo contenido", () => {
    expect(buildHash({ "a.js": "1" })).not.toBe(buildHash({ "otro.js": "1" }));
  });
});

describe("compareManifests", () => {
  test("idénticos", () => {
    const files = { "index.html": "x", "assets/a.js": "y" };
    expect(identical(compareManifests(files, { ...files }))).toBe(true);
  });

  test("dice qué archivo difiere y qué sobra de cada lado", () => {
    const comparison = compareManifests(
      { "index.html": "x", "assets/a.js": "y", "extra.js": "z" },
      { "index.html": "x", "assets/a.js": "otro", "nuevo.js": "w" },
    );
    expect(comparison.different).toEqual(["assets/a.js"]);
    expect(comparison.onlyLive).toEqual(["extra.js"]);
    expect(comparison.onlyLocal).toEqual(["nuevo.js"]);
    expect(identical(comparison)).toBe(false);
  });
});
