import { describe, expect, test } from "bun:test";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";
import { toRanking } from "./ranking.ts";
import { highlightCap, levelFromYears, pickHighlights } from "./match.ts";
import { EMPTY_PREFERENCES, type Job, type Mix, type Preferences } from "./types.ts";

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({
  ...EMPTY_PREFERENCES,
  categories: ["tecnologia"],
  ...overrides,
});

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  education: "university",
  experienceYears: 5,
  ...overrides,
});

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "a",
  source: "buscojobs",
  source_id: "1",
  title: "Dev",
  company: "X",
  department: "Montevideo",
  city: "Montevideo",
  category: "tecnologia",
  category_label: "Tecnología",
  date_posted: "2026-08-01T00:00:00",
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: 1,
  closes_at: null,
  description: "",
  requirements: null,
  apply_url: "https://ejemplo.uy/1",
  duplicates: [],
  ...overrides,
});

const many = (count: number, extra: Partial<Job> = {}): Job[] =>
  Array.from({ length: count }, (_, i) =>
    job({
      id: String(i),
      date_posted: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T00:00:00`,
      ...extra,
    }),
  );

describe("levelFromYears", () => {
  test("folds years into the three levels the board uses", () => {
    expect(levelFromYears(0)).toBe("entry");
    expect(levelFromYears(1)).toBe("entry");
    expect(levelFromYears(3)).toBe("mid");
    expect(levelFromYears(5)).toBe("senior");
  });
});

describe("highlightCap", () => {
  test("broad keeps every match", () => {
    expect(highlightCap(49, "broad")).toBe(49);
  });

  test("balanced and focused cap a long matching list", () => {
    expect(highlightCap(49, "balanced")).toBe(16);
    expect(highlightCap(49, "focused")).toBe(8);
  });

  test("a short list still keeps a handful", () => {
    expect(highlightCap(5, "focused")).toBe(3);
    expect(highlightCap(5, "balanced")).toBe(4);
  });
});

describe("pickHighlights", () => {
  const rankingOf = (p: Preferences, who: Profile = profile()) => toRanking(p, who);

  test("without preferences nothing is marked", () => {
    expect(pickHighlights(many(10), EMPTY_PREFERENCES, rankingOf(EMPTY_PREFERENCES), profile()).size).toBe(
      0,
    );
  });

  test("broad marks every preference hit", () => {
    const p = prefs({ mix: "broad" });
    const jobs = [...many(8), job({ id: "other", category: "ventas" })];
    expect(pickHighlights(jobs, p, rankingOf(p), profile()).size).toBe(8);
  });

  test("balanced does not stamp a whole rubro", () => {
    const p = prefs({ mix: "balanced" });
    expect(pickHighlights(many(49), p, rankingOf(p), profile()).size).toBe(16);
  });

  test("focused keeps a short list", () => {
    const p = prefs({ mix: "focused" });
    expect(pickHighlights(many(49), p, rankingOf(p), profile()).size).toBe(8);
  });

  test("a senior profile prefers senior offers over junior ones", () => {
    const p = prefs({ mix: "focused" });
    const jobs = [
      job({ id: "junior", level: "entry", date_posted: "2026-09-01T00:00:00" }),
      ...many(10, { level: "senior" }),
    ];
    const marked = pickHighlights(jobs, p, rankingOf(p), profile());
    expect(marked.has("junior")).toBe(false);
    expect(marked.size).toBeGreaterThan(0);
  });

  const mixes: Mix[] = ["broad", "balanced", "focused"];
  test("an offer that fails a checkable requirement is never marked except in broad", () => {
    const short = job({
      id: "short",
      education_level: "Posgrado",
      date_posted: "2026-09-01T00:00:00",
    });
    for (const mix of mixes) {
      const p = prefs({ mix });
      const marked = pickHighlights([short, ...many(10)], p, rankingOf(p), profile());
      expect(marked.has("short")).toBe(mix === "broad");
    }
  });
});
