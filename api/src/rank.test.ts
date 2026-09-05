import { describe, expect, test } from "bun:test";
import {
  EMPTY_RANKING,
  type Ranking,
  isEmptyRanking,
  requiredEducation,
  scoreJob,
} from "./rank.ts";
import type { Job } from "./types.ts";

const NOW = Date.parse("2026-08-17T00:00:00Z");

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "a",
  source: "buscojobs",
  source_id: "1",
  title: "Vendedor de salón",
  company: "Empresa SA",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-08-16T00:00:00",
  level: "mid",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: 2,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: 1,
  closes_at: null,
  description: "Atención al público.",
  requirements: null,
  apply_url: "https://www.buscojobs.com.uy/x-ID-1",
  duplicates: [],
  ...overrides,
});

/** Isolates one dimension: the shared terms cancel out between two offers. */
const rank = (overrides: Partial<Ranking>): Ranking => ({ ...EMPTY_RANKING, ...overrides });

describe("isEmptyRanking", () => {
  test("an untouched ranking says so", () => {
    expect(isEmptyRanking(EMPTY_RANKING)).toBe(true);
  });

  test("one filled dimension is enough to rank", () => {
    expect(isEmptyRanking(rank({ categories: ["ventas"] }))).toBe(false);
    expect(isEmptyRanking(rank({ experienceYears: 0 }))).toBe(false);
    expect(isEmptyRanking(rank({ noExperience: true }))).toBe(false);
  });
});

describe("scoreJob", () => {
  test("a preferred rubro beats one that was not asked for", () => {
    const ranking = rank({ categories: ["tecnologia"] });
    const wanted = scoreJob(job({ category: "tecnologia" }), ranking, NOW);
    expect(wanted).toBeGreaterThan(scoreJob(job(), ranking, NOW));
  });

  test("order inside the list decides: the first rubro outranks the second", () => {
    const ranking = rank({ categories: ["tecnologia", "ventas", "logistica"] });
    const first = scoreJob(job({ category: "tecnologia" }), ranking, NOW);
    const second = scoreJob(job({ category: "ventas" }), ranking, NOW);
    const third = scoreJob(job({ category: "logistica" }), ranking, NOW);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
  });

  test("a rubro left out of the list still scores above nothing", () => {
    const ranking = rank({ categories: ["tecnologia"] });
    expect(scoreJob(job({ category: "salud" }), ranking, NOW)).toBeGreaterThan(0);
  });

  test("the wanted work mode and level add up", () => {
    const ranking = rank({ modes: ["remote"], levels: ["entry"] });
    const both = scoreJob(job({ remote: "remote", level: "entry" }), ranking, NOW);
    const one = scoreJob(job({ remote: "remote" }), ranking, NOW);
    expect(both).toBeGreaterThan(one);
  });

  test("pay at or above the target beats pay below it", () => {
    const ranking = rank({ salaryTarget: 60_000 });
    const good = job({ salary: { min: 60_000, max: 80_000, currency: "UYU" } });
    const poor = job({ salary: { min: 25_000, max: 30_000, currency: "UYU" } });
    expect(scoreJob(good, ranking, NOW)).toBeGreaterThan(scoreJob(poor, ranking, NOW));
  });

  test("an offer asking for more schooling than the person has is pushed down", () => {
    const ranking = rank({ education: 3 });
    const reachable = job({ education_level: "Bachillerato completo" });
    const beyond = job({ education_level: "Título universitario" });
    expect(scoreJob(reachable, ranking, NOW)).toBeGreaterThan(scoreJob(beyond, ranking, NOW));
    expect(scoreJob(beyond, ranking, NOW)).toBeLessThan(0);
  });

  test("experience asked for above what the person has is pushed down", () => {
    const ranking = rank({ experienceYears: 1 });
    const reachable = job({ experience_years_min: 1 });
    const beyond = job({ experience_years_min: 5 });
    expect(scoreJob(reachable, ranking, NOW)).toBeGreaterThan(scoreJob(beyond, ranking, NOW));
  });

  test("a first-job offer answers someone with no experience", () => {
    const ranking = rank({ noExperience: true, experienceYears: 0 });
    const first = job({ no_experience: true, experience_years_min: null });
    expect(scoreJob(first, ranking, NOW)).toBeGreaterThan(scoreJob(job(), ranking, NOW));
  });

  test("between two equal offers the fresher one wins", () => {
    const ranking = rank({ categories: ["ventas"] });
    const fresh = scoreJob(job({ date_posted: "2026-08-16T00:00:00" }), ranking, NOW);
    const stale = scoreJob(job({ date_posted: "2026-06-01T00:00:00" }), ranking, NOW);
    expect(fresh).toBeGreaterThan(stale);
  });

  test("a deadline about to pass lifts an offer, an expired one sinks it", () => {
    const ranking = rank({ categories: ["ventas"] });
    const soon = scoreJob(job({ closes_at: "2026-08-19T00:00:00Z" }), ranking, NOW);
    const later = scoreJob(job({ closes_at: "2026-11-01T00:00:00Z" }), ranking, NOW);
    const gone = scoreJob(job({ closes_at: "2026-08-01T00:00:00Z" }), ranking, NOW);
    expect(soon).toBeGreaterThan(later);
    expect(gone).toBeLessThan(later);
  });

  test("broad lets a fresh off-category offer beat a stale match", () => {
    const wanted = job({ category: "tecnologia", date_posted: "2026-06-01T00:00:00" });
    const other = job({ category: "salud", date_posted: "2026-08-16T00:00:00" });
    const focused = rank({ categories: ["tecnologia"], mix: "focused" });
    const broad = rank({ categories: ["tecnologia"], mix: "broad" });

    expect(scoreJob(wanted, focused, NOW)).toBeGreaterThan(scoreJob(other, focused, NOW));
    expect(scoreJob(other, broad, NOW)).toBeGreaterThan(scoreJob(wanted, broad, NOW));
  });
});

describe("requiredEducation", () => {
  test("reads the level out of the free text each source writes", () => {
    expect(requiredEducation("Ciclo básico aprobado")).toBe(2);
    expect(requiredEducation("Bachillerato completo")).toBe(3);
    expect(requiredEducation("Tecnicatura o UTU")).toBe(4);
    expect(requiredEducation("Título universitario")).toBe(5);
    expect(requiredEducation("Maestría en la materia")).toBe(6);
  });

  test("stays quiet on an unknown wording and on nothing at all", () => {
    expect(requiredEducation("A convenir")).toBeNull();
    expect(requiredEducation(null)).toBeNull();
  });
});
