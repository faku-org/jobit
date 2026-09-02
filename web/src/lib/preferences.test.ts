import { describe, expect, test } from "bun:test";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";
import { isEmptyRanking, toRanking } from "./ranking.ts";
import type { Preferences } from "./types.ts";
import {
  EMPTY_PREFERENCES,
  hiddenCount,
  nextStance,
  preferenceCount,
  reorder,
  setStance,
  stanceOf,
} from "./types.ts";

const preferences = (overrides: Partial<Preferences> = {}): Preferences => ({
  ...EMPTY_PREFERENCES,
  ...overrides,
});

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  ...overrides,
});

describe("reorder", () => {
  test("moves an entry to the position asked for", () => {
    expect(reorder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(reorder(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  test("a move that goes nowhere returns the same list", () => {
    const list = ["a", "b", "c"];
    expect(reorder(list, 1, 1)).toBe(list);
    expect(reorder(list, 0, 9)).toBe(list);
    expect(reorder(list, -1, 0)).toBe(list);
  });
});

describe("stances", () => {
  const lists = { wanted: ["tecnologia"], hidden: ["ventas"] };

  test("reads back what was set", () => {
    expect(stanceOf(lists, "tecnologia")).toBe("wanted");
    expect(stanceOf(lists, "ventas")).toBe("hidden");
    expect(stanceOf(lists, "salud")).toBe("neutral");
  });

  test("wanting something hidden takes it out of the hidden list", () => {
    expect(setStance(lists, "ventas", "wanted")).toEqual({
      wanted: ["tecnologia", "ventas"],
      hidden: [],
    });
  });

  test("hiding something wanted takes it out of the wanted list", () => {
    expect(setStance(lists, "tecnologia", "hidden")).toEqual({
      wanted: [],
      hidden: ["ventas", "tecnologia"],
    });
  });

  test("neutral clears both", () => {
    expect(setStance(lists, "tecnologia", "neutral")).toEqual({
      wanted: [],
      hidden: ["ventas"],
    });
  });

  test("the chip cycles through the three and back", () => {
    expect(nextStance("neutral")).toBe("wanted");
    expect(nextStance("wanted")).toBe("hidden");
    expect(nextStance("hidden")).toBe("neutral");
  });
});

describe("counts", () => {
  test("what is wanted and what is hidden are counted apart", () => {
    const current = preferences({
      categories: ["tecnologia", "salud"],
      hiddenCategories: ["ventas"],
      hiddenDepartments: ["Rivera"],
      modes: ["remote"],
    });
    expect(preferenceCount(current)).toBe(3);
    expect(hiddenCount(current)).toBe(2);
  });

  test("a salary range counts as one preference", () => {
    const current = preferences({ salary: { min: 50_000, max: null, includeUnknown: true } });
    expect(preferenceCount(current)).toBe(1);
  });

  test("hidden rubros do not count as things wanted", () => {
    expect(preferenceCount(preferences({ hiddenCategories: ["ventas"] }))).toBe(0);
  });
});

describe("toRanking", () => {
  test("carries the order of the rubros through untouched", () => {
    const ranking = toRanking(preferences({ categories: ["salud", "tecnologia"] }), EMPTY_PROFILE);
    expect(ranking.categories).toEqual(["salud", "tecnologia"]);
  });

  test("the floor of the salary range is what is aimed at", () => {
    const current = preferences({ salary: { min: 45_000, max: 90_000, includeUnknown: true } });
    expect(toRanking(current, EMPTY_PROFILE).salaryTarget).toBe(45_000);
  });

  test("the profile decides the education and experience terms", () => {
    const ranking = toRanking(EMPTY_PREFERENCES, profile({ education: "technical" }));
    expect(ranking.education).toBe(4);
    expect(isEmptyRanking(ranking)).toBe(false);
  });

  test("saying zero years of experience asks for first-job offers", () => {
    expect(toRanking(EMPTY_PREFERENCES, profile({ experienceYears: 0 })).noExperience).toBe(true);
  });

  test("an untouched profile and no preferences rank nothing", () => {
    expect(isEmptyRanking(toRanking(EMPTY_PREFERENCES, EMPTY_PROFILE))).toBe(true);
  });
});
