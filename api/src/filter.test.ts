import { describe, expect, test } from "bun:test";
import { categoryFacets, departmentFacets, filterJobs } from "./filter.ts";
import type { Job } from "./types.ts";

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
    expect(filterJobs(jobs, { ...base, category: "logistica" }, NOW).jobs[0]?.id).toBe("b");
    expect(filterJobs(jobs, { ...base, category: "ventas" }, NOW).total).toBe(1);
  });

  test("department filter", () => {
    expect(filterJobs(jobs, { ...base, department: "Canelones" }, NOW).total).toBe(1);
    expect(filterJobs(jobs, { ...base, department: "Montevideo" }, NOW).total).toBe(2);
  });

  test("no_experience filter keeps only first-job offers", () => {
    const result = filterJobs(jobs, { ...base, noExperience: true }, NOW);
    expect(result.jobs.map((j) => j.id).sort()).toEqual(["a", "c"]);
  });

  test("job_type filter", () => {
    expect(filterJobs(jobs, { ...base, jobType: "internship" }, NOW).jobs[0]?.id).toBe("c");
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
    const result = filterJobs(jobs, { ...base, noExperience: true, level: "entry", days: 7 }, NOW);
    expect(result.jobs.map((j) => j.id)).toEqual(["a"]);
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
