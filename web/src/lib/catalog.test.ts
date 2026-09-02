import { describe, expect, test } from "bun:test";
import {
  COURSES,
  DEGREES,
  courseById,
  degreeById,
  groupCatalog,
  isCourseId,
  isDegreeId,
  searchCatalog,
} from "./catalog.ts";
import { EMPTY_PROFILE, levelFromDegrees, withDegrees } from "./profile.ts";

const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

describe("catalog", () => {
  test("every id is unique, since it is what gets stored", () => {
    expect(new Set(ids(DEGREES)).size).toBe(DEGREES.length);
    expect(new Set(ids(COURSES)).size).toBe(COURSES.length);
  });

  test("lookups answer for what is on the list and stay quiet for the rest", () => {
    expect(degreeById("magisterio")?.label).toBe("Magisterio");
    expect(courseById("libreta-b")?.group).toBe("Certificaciones y carnés");
    expect(degreeById("lo-que-sea")).toBeUndefined();
    expect(isDegreeId("mba")).toBe(true);
    expect(isCourseId("mba")).toBe(false);
  });
});

describe("searchCatalog", () => {
  test("finds by label, ignoring accents and case", () => {
    expect(ids(searchCatalog(DEGREES, "MAGISTERIO"))).toContain("magisterio");
    expect(ids(searchCatalog(COURSES, "ingles"))).toContain("ingles-avanzado");
  });

  test("finds by the words people actually use", () => {
    expect(ids(searchCatalog(DEGREES, "maestro"))).toContain("magisterio");
    expect(ids(searchCatalog(COURSES, "montacargas"))).toContain("autoelevador");
  });

  test("every word of the query has to match", () => {
    expect(ids(searchCatalog(DEGREES, "ingenieria civil"))).toEqual(["ing-civil"]);
    expect(searchCatalog(DEGREES, "ingenieria zoologia")).toEqual([]);
  });

  test("an empty query is the whole list", () => {
    expect(searchCatalog(COURSES, "   ").length).toBe(COURSES.length);
  });
});

describe("groupCatalog", () => {
  test("keeps catalog order and puts each entry under one heading", () => {
    const groups = groupCatalog(searchCatalog(DEGREES, "informatica"));
    expect(groups.map(([name]) => name)).toEqual([
      "Bachillerato",
      "Técnico y terciario",
      "Universitario",
    ]);
  });
});

describe("levels implied by a título", () => {
  test("takes the highest of what was picked", () => {
    expect(levelFromDegrees(["bach-informatica", "lic-informatica"])).toBe("university");
    expect(levelFromDegrees(["emt-informatica", "bach-informatica"])).toBe("technical");
    expect(levelFromDegrees([])).toBe("");
    expect(levelFromDegrees(["ya-no-existe"])).toBe("");
  });

  test("adding a higher título raises the level", () => {
    const started = { ...EMPTY_PROFILE, education: "secondary" as const };
    expect(withDegrees(started, ["lic-informatica"]).education).toBe("university");
  });

  test("a lower título never lowers a level the person set", () => {
    const graduate = { ...EMPTY_PROFILE, education: "postgrad" as const };
    expect(withDegrees(graduate, ["bach-informatica"]).education).toBe("postgrad");
  });
});
