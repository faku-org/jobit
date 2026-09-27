import { describe, expect, test } from "bun:test";
import type { MarketReport } from "./market.ts";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";
import { buildNews, isEntryProfile, matchReasons } from "./news.ts";
import { EMPTY_PREFERENCES, type Job, type Preferences } from "./types.ts";

const NOW = Date.parse("2026-09-27T12:00:00");

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
  date_posted: "2026-09-20T00:00:00",
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

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({
  ...EMPTY_PREFERENCES,
  categories: ["tecnologia"],
  ...overrides,
});

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  experienceYears: 5,
  ...overrides,
});

const report = (overrides: Partial<MarketReport> = {}): MarketReport => ({
  count: 100,
  scraped_at: "2026-09-27T08:00:00",
  fresh7: 12,
  fresh30: 40,
  noExperience: 20,
  withSalary: 30,
  salary: { count: 30, min: 15000, p25: 25000, median: 40000, p75: 60000, max: 90000 },
  sources: [],
  roles: [],
  categories: [
    { value: "tecnologia", label: "Tecnología", count: 40, noExperience: 5, salary: null },
    { value: "ventas", label: "Ventas", count: 25, noExperience: 8, salary: null },
  ],
  departments: [],
  skills: [],
  levels: [],
  modes: [],
  jobTypes: [],
  entryFriendly: [],
  ...overrides,
});

describe("matchReasons", () => {
  test("names the dimensions that make an offer fit", () => {
    const reasons = matchReasons(
      job({ department: "Canelones", level: "entry", remote: "remote", job_type: "full_time" }),
      prefs({
        departments: ["Canelones"],
        levels: ["entry"],
        modes: ["remote"],
        jobTypes: ["full_time"],
      }),
    );
    expect(reasons).toContain("En tu rubro: Tecnología");
    expect(reasons).toContain("En Canelones");
    expect(reasons).toContain("Remoto");
    expect(reasons).toContain("Junior");
    expect(reasons).toContain("Jornada completa");
  });

  test("an offer outside the preferences has no reason", () => {
    expect(matchReasons(job({ category: "ventas" }), prefs())).toEqual([]);
  });
});

describe("buildNews", () => {
  test("only recommends offers that meet the preferences, and says why", () => {
    const news = buildNews({
      jobs: [
        job({ id: "fit", date_posted: "2026-09-26T00:00:00" }),
        job({ id: "other", category: "ventas", category_label: "Ventas" }),
      ],
      followed: [],
      preferences: prefs(),
      market: null,
      now: NOW,
    });

    expect(news.matches.map((entry) => entry.job.id)).toEqual(["fit"]);
    expect(news.matches[0]?.reasons).toEqual(["En tu rubro: Tecnología"]);
    expect(news.matches[0]?.fresh).toBe(true);
  });

  test("without preferences there is nothing to recommend", () => {
    const news = buildNews({
      jobs: [job(), job({ id: "b" })],
      followed: [],
      preferences: EMPTY_PREFERENCES,
      market: null,
      now: NOW,
    });
    expect(news.matches).toEqual([]);
  });

  test("caps the recommendations", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job({ id: String(i) }));
    const news = buildNews({ jobs, followed: [], preferences: prefs(), market: null, now: NOW });
    expect(news.matches.length).toBe(4);
  });

  test("marks practices and offers that ask for no experience", () => {
    const news = buildNews({
      jobs: [
        job({ id: "intern", job_type: "internship" }),
        job({ id: "none", no_experience: true }),
        job({ id: "plain" }),
      ],
      followed: [],
      preferences: prefs(),
      market: null,
      now: NOW,
    });
    expect(news.starters.map((entry) => entry.job.id)).toEqual(["intern", "none"]);
    expect(news.starters[0]?.reasons).toEqual(["Pasantía"]);
    expect(news.starters[1]?.reasons).toEqual(["No piden experiencia"]);
  });

  test("keeps only the near, upcoming closings of what is followed, soonest first", () => {
    const news = buildNews({
      jobs: [],
      followed: [
        job({ id: "far", closes_at: "2026-12-01T00:00:00" }),
        job({ id: "soon", closes_at: "2026-09-28T00:00:00" }),
        job({ id: "past", closes_at: "2026-09-01T00:00:00" }),
        job({ id: "later", closes_at: "2026-10-03T00:00:00" }),
      ],
      preferences: prefs(),
      market: null,
      now: NOW,
    });

    expect(news.closings.map((entry) => entry.job.id)).toEqual(["soon", "later"]);
    expect(news.closings[0]?.daysLeft).toBe(1);
  });

  test("summarises the market without inventing a trend", () => {
    const news = buildNews({
      jobs: [],
      followed: [],
      preferences: prefs(),
      market: report(),
      now: NOW,
    });

    expect(news.market?.fresh7).toBe(12);
    expect(news.market?.median).toBe(40000);
    expect(news.market?.total).toBe(100);
    expect(news.market?.topCategories[0]).toEqual({
      value: "tecnologia",
      label: "Tecnología",
      count: 40,
    });
    expect(news.hasHistory).toBe(false);
  });

  test("no market yet means no market block", () => {
    const news = buildNews({
      jobs: [],
      followed: [],
      preferences: prefs(),
      market: null,
      now: NOW,
    });
    expect(news.market).toBeNull();
  });
});

describe("isEntryProfile", () => {
  test("nobody with years of experience is treated as a beginner", () => {
    expect(isEntryProfile(profile({ experienceYears: null }))).toBe(true);
    expect(isEntryProfile(profile({ experienceYears: 1 }))).toBe(true);
    expect(isEntryProfile(profile({ experienceYears: 4 }))).toBe(false);
  });
});
