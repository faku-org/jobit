import { describe, expect, test } from "bun:test";
import type { CustomFeed } from "./feed.ts";
import { advancedSummary, searchSummary, workSummary } from "./sections.ts";
import type { Facet, Preferences } from "./types.ts";
import { EMPTY_PREFERENCES } from "./types.ts";

const preferences = (overrides: Partial<Preferences> = {}): Preferences => ({
  ...EMPTY_PREFERENCES,
  ...overrides,
});

const CATEGORIES: Facet[] = [
  { value: "tecnologia", label: "Tecnología", count: 40 },
  { value: "ventas", label: "Ventas", count: 12 },
];

const DEPARTMENTS: Facet[] = [
  { value: "Montevideo", label: "Montevideo", count: 90 },
  { value: "Canelones", label: "Canelones", count: 8 },
];

const feed = (overrides: Partial<CustomFeed> = {}): CustomFeed => ({
  id: "feed-1",
  url: "https://ejemplo.uy/jobs.json",
  label: "Mi feed",
  enabled: true,
  ...overrides,
});

describe("searchSummary", () => {
  test("nothing set says nothing", () => {
    expect(searchSummary(preferences(), CATEGORIES, DEPARTMENTS)).toBe("");
  });

  test("one of something is named, more than one is counted", () => {
    expect(
      searchSummary(preferences({ categories: ["tecnologia"] }), CATEGORIES, DEPARTMENTS),
    ).toBe("Tecnología");
    expect(
      searchSummary(
        preferences({ categories: ["tecnologia", "ventas"], departments: ["Montevideo"] }),
        CATEGORIES,
        DEPARTMENTS,
      ),
    ).toBe("2 rubros · Montevideo");
  });

  test("what was hidden counts too, from either list", () => {
    expect(
      searchSummary(
        preferences({ hiddenCategories: ["ventas"], hiddenDepartments: ["Canelones"] }),
        CATEGORIES,
        DEPARTMENTS,
      ),
    ).toBe("2 ocultos");
  });

  test("a value the board no longer offers falls back to itself", () => {
    expect(searchSummary(preferences({ categories: ["nautica"] }), CATEGORIES, DEPARTMENTS)).toBe(
      "nautica",
    );
  });
});

describe("workSummary", () => {
  test("reads in the order the onboarding asks", () => {
    expect(
      workSummary(
        preferences({
          modes: ["remote"],
          jobTypes: ["full_time"],
          levels: ["entry"],
          salary: { min: 40_000, max: null, includeUnknown: true },
        }),
      ),
    ).toBe("desde $ 40.000 · Remoto · Jornada completa · Junior");
  });

  test("leaving out the offers without pay is a preference on its own", () => {
    expect(
      workSummary(preferences({ salary: { min: null, max: null, includeUnknown: false } })),
    ).toBe("con sueldo publicado");
  });

  test("wanting no experience shows up", () => {
    expect(workSummary(preferences({ noExperience: true }))).toBe("sin experiencia");
  });
});

describe("advancedSummary", () => {
  const all = ["buscojobs", "gallito"];

  test("no source chosen means every one of them", () => {
    expect(advancedSummary([], all, [])).toBe("todas las fuentes");
  });

  test("a board with no sources yet says nothing", () => {
    expect(advancedSummary([], [], [])).toBe("");
  });

  test("one source is named, more than one is counted", () => {
    expect(advancedSummary(["gallito"], all, [])).toBe("Gallito");
    expect(advancedSummary(["gallito", "buscojobs"], all, [])).toBe("2 fuentes");
  });

  test("only the feeds that are on are counted", () => {
    expect(advancedSummary([], all, [feed(), feed({ id: "feed-2", enabled: false })])).toBe(
      "todas las fuentes · 1 feed propio",
    );
  });
});
