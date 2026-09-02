import { describe, expect, test } from "bun:test";
import { categoryFacets, departmentFacets, filterJobs } from "./filter.ts";
import { EMPTY_RANKING } from "./rank.ts";
import type { Job, WorkMode } from "./types.ts";

const NOW = Date.parse("2026-08-17T00:00:00Z");

const job = (overrides: Partial<Job> & Pick<Job, "id">): Job => ({
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
  description: "Atención al público en local comercial.",
  requirements: null,
  apply_url: "https://www.buscojobs.com.uy/x-ID-1",
  duplicates: [],
  ...overrides,
});

const base = { limit: 50, offset: 0 };

const jobs: Job[] = [
  job({ id: "a", title: "Cajero sin experiencia", no_experience: true, level: "entry" }),
  job({
    id: "b",
    title: "Chofer repartidor",
    company: "Distribuidora del Este",
    category: "logistica",
    category_label: "Logística y distribución",
    department: "Canelones",
    city: "Las Piedras",
    description: "Reparto de mercadería con camioneta.",
  }),
  job({
    id: "c",
    title: "Pasantía administrativa",
    category: "administracion",
    category_label: "Administración y gestión",
    job_type: "internship",
    no_experience: true,
    level: "entry",
    remote: "hybrid",
    date_posted: "2026-07-01T00:00:00",
  }),
];

describe("filterJobs", () => {
  test("returns everything when no filters are given", () => {
    expect(filterJobs(jobs, base, NOW).total).toBe(3);
  });

  test("q searches title, company, location, rubro and description", () => {
    expect(filterJobs(jobs, { ...base, q: "cajero" }, NOW).jobs[0]?.id).toBe("a");
    expect(filterJobs(jobs, { ...base, q: "distribuidora" }, NOW).jobs[0]?.id).toBe("b");
    expect(filterJobs(jobs, { ...base, q: "las piedras" }, NOW).jobs[0]?.id).toBe("b");
    expect(filterJobs(jobs, { ...base, q: "mercadería" }, NOW).jobs[0]?.id).toBe("b");
    expect(filterJobs(jobs, { ...base, q: "logística" }, NOW).jobs[0]?.id).toBe("b");
  });

  test("q ignores accents in either direction", () => {
    expect(filterJobs(jobs, { ...base, q: "pasantia" }, NOW).jobs[0]?.id).toBe("c");
    expect(filterJobs(jobs, { ...base, q: "mercaderia" }, NOW).jobs[0]?.id).toBe("b");
  });

  test("category filter", () => {
    expect(filterJobs(jobs, { ...base, categories: new Set(["logistica"]) }, NOW).jobs[0]?.id).toBe(
      "b",
    );
    expect(filterJobs(jobs, { ...base, categories: new Set(["ventas"]) }, NOW).total).toBe(1);
    expect(
      filterJobs(jobs, { ...base, categories: new Set(["ventas", "logistica"]) }, NOW).total,
    ).toBe(2);
  });

  test("source filter keeps only the chosen job boards", () => {
    const mixed = [...jobs, job({ id: "d", source: "gallito" })];
    expect(filterJobs(mixed, { ...base, sources: new Set(["gallito"]) }, NOW).jobs[0]?.id).toBe(
      "d",
    );
    expect(filterJobs(mixed, { ...base, sources: new Set(["buscojobs"]) }, NOW).total).toBe(3);
    expect(
      filterJobs(mixed, { ...base, sources: new Set(["buscojobs", "gallito"]) }, NOW).total,
    ).toBe(4);
  });

  test("department filter", () => {
    expect(filterJobs(jobs, { ...base, departments: new Set(["Canelones"]) }, NOW).total).toBe(1);
    expect(filterJobs(jobs, { ...base, departments: new Set(["Montevideo"]) }, NOW).total).toBe(2);
  });

  test("no_experience filter keeps only first-job offers", () => {
    const result = filterJobs(jobs, { ...base, noExperience: true }, NOW);
    expect(result.jobs.map((j) => j.id).sort()).toEqual(["a", "c"]);
  });

  test("work mode filter treats a null remote as on-site", () => {
    const mode = (...values: WorkMode[]) => ({ ...base, workModes: new Set(values) });
    expect(filterJobs(jobs, mode("hybrid"), NOW).jobs[0]?.id).toBe("c");
    expect(filterJobs(jobs, mode("onsite"), NOW).jobs.map((j) => j.id)).toEqual(["a", "b"]);
    expect(filterJobs(jobs, mode("remote"), NOW).total).toBe(0);
    expect(filterJobs(jobs, mode("remote", "hybrid"), NOW).jobs.map((j) => j.id)).toEqual(["c"]);
  });

  test("job_type filter", () => {
    expect(filterJobs(jobs, { ...base, jobTypes: new Set(["internship"]) }, NOW).jobs[0]?.id).toBe(
      "c",
    );
  });

  test("ids filter selects an explicit set", () => {
    const result = filterJobs(jobs, { ...base, ids: new Set(["a", "c"]) }, NOW);
    expect(result.jobs.map((j) => j.id)).toEqual(["a", "c"]);
  });

  test("days filter drops older offers", () => {
    expect(filterJobs(jobs, { ...base, days: 7 }, NOW).total).toBe(2);
    expect(filterJobs(jobs, { ...base, days: 60 }, NOW).total).toBe(3);
  });

  test("filters combine", () => {
    const result = filterJobs(
      jobs,
      { ...base, noExperience: true, levels: new Set(["entry"]), days: 7 },
      NOW,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["a"]);
  });

  test("closing sort puts the nearest deadline first, undated offers last", () => {
    const dated = [
      job({ id: "x", closes_at: "2026-09-30T23:59:59.000Z" }),
      job({ id: "y", closes_at: "2026-09-10T23:59:59.000Z" }),
      ...jobs,
    ];
    const result = filterJobs(dated, { ...base, sort: "closing" }, NOW);
    expect(result.jobs.map((j) => j.id)).toEqual(["y", "x", "a", "b", "c"]);
  });

  test("pagination reports the full total", () => {
    const result = filterJobs(jobs, { limit: 1, offset: 1 }, NOW);
    expect(result).toMatchObject({ total: 3, offset: 1, limit: 1 });
    expect(result.jobs.map((j) => j.id)).toEqual(["b"]);
  });
});

describe("facets", () => {
  test("categories are counted and sorted by frequency", () => {
    expect(categoryFacets(jobs)).toEqual([
      { value: "administracion", label: "Administración y gestión", count: 1 },
      { value: "logistica", label: "Logística y distribución", count: 1 },
      { value: "ventas", label: "Ventas y comercial", count: 1 },
    ]);
  });

  test("departments are counted", () => {
    expect(departmentFacets(jobs)[0]).toEqual({
      value: "Montevideo",
      label: "Montevideo",
      count: 2,
    });
  });
});

describe("exclusions", () => {
  test("hidden rubros never come back", () => {
    const result = filterJobs(jobs, { ...base, hiddenCategories: new Set(["ventas"]) }, NOW);
    expect(result.jobs.map((j) => j.id).sort()).toEqual(["b", "c"]);
  });

  test("hidden departments never come back", () => {
    const result = filterJobs(jobs, { ...base, hiddenDepartments: new Set(["Canelones"]) }, NOW);
    expect(result.jobs.map((j) => j.id).sort()).toEqual(["a", "c"]);
  });

  test("an offer without a department survives a hidden department", () => {
    const nowhere = [job({ id: "d", department: null })];
    const query = { ...base, hiddenDepartments: new Set(["Montevideo"]) };
    expect(filterJobs(nowhere, query, NOW).total).toBe(1);
  });
});

describe("salary range", () => {
  const paid = [
    job({ id: "low", salary: { min: 25_000, max: 30_000, currency: "UYU" } }),
    job({ id: "high", salary: { min: 90_000, max: 120_000, currency: "UYU" } }),
    job({ id: "unknown", salary: null }),
  ];

  test("keeps the offers whose range overlaps the one asked for", () => {
    const salary = { min: 60_000, max: null, includeUnknown: false };
    expect(filterJobs(paid, { ...base, salary }, NOW).jobs.map((j) => j.id)).toEqual(["high"]);
  });

  test("an upper bound drops what starts above it", () => {
    const salary = { min: null, max: 50_000, includeUnknown: false };
    expect(filterJobs(paid, { ...base, salary }, NOW).jobs.map((j) => j.id)).toEqual(["low"]);
  });

  test("offers with no published pay are kept unless asked otherwise", () => {
    const salary = { min: 60_000, max: null, includeUnknown: true };
    const found = filterJobs(paid, { ...base, salary }, NOW).jobs.map((j) => j.id);
    expect(found.sort()).toEqual(["high", "unknown"]);
  });
});

describe("match sort", () => {
  test("the preferred rubro comes first, and the head of the list wins", () => {
    const ranking = { ...EMPTY_RANKING, categories: ["administracion", "logistica"] };
    const result = filterJobs(jobs, { ...base, sort: "match", ranking }, NOW);
    expect(result.jobs.map((j) => j.id)).toEqual(["c", "b", "a"]);
  });

  test("without a ranking the order is left alone", () => {
    const result = filterJobs(jobs, { ...base, sort: "match" }, NOW);
    expect(result.jobs.map((j) => j.id)).toEqual(["a", "b", "c"]);
  });
});
