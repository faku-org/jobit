import { describe, expect, test } from "bun:test";
import { buildMarketReport, summarize } from "./market.ts";
import { ROLES, roleOf } from "@jobit/worker/roles";
import type { Job } from "./types.ts";

const NOW = Date.parse("2026-09-02T00:00:00Z");

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
  date_posted: "2026-09-01T00:00:00",
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
  description: "",
  requirements: null,
  apply_url: "https://www.buscojobs.com.uy/x-ID-1",
  duplicates: [],
  ...overrides,
});

const paid = (id: string, amount: number, rest: Partial<Job> = {}) =>
  job({ id, salary: { min: amount, max: null, currency: "UYU" }, ...rest });

describe("summarize", () => {
  test("reports the quartiles of what it was given", () => {
    expect(summarize([10, 20, 30, 40, 50])).toEqual({
      count: 5,
      min: 10,
      p25: 20,
      median: 30,
      p75: 40,
      max: 50,
    });
  });

  test("a handful of numbers is an anecdote, not a range", () => {
    expect(summarize([10, 20, 30])).toBeNull();
  });
});

describe("roleOf", () => {
  test("reads the puesto out of a title however it is shouted", () => {
    expect(roleOf("BUSCAMOS VENDEDOR SENIOR PARA IMPORTADORA")?.slug).toBe("vendedor");
    expect(roleOf("Chofer repartidor con libreta")?.slug).toBe("chofer");
    expect(roleOf("Desarrollador/a Full Stack")?.slug).toBe("desarrollador");
  });

  test("a specific puesto wins over the generic rank in the same title", () => {
    expect(roleOf("Auxiliar de limpieza")?.slug).toBe("limpieza");
    expect(roleOf("Auxiliar contable")?.slug).toBe("administrativo-contable");
  });

  test("the catch-all ranks still catch what is left", () => {
    expect(roleOf("Auxiliar para tareas varias")?.slug).toBe("auxiliar");
  });

  test("a title that names no puesto says so", () => {
    expect(roleOf("G°3 20hrs-Met-Investigación-TUBICU")).toBeNull();
  });

  test("every role has a distinct slug", () => {
    expect(new Set(ROLES.map((role) => role.slug)).size).toBe(ROLES.length);
  });
});

describe("buildMarketReport", () => {
  const jobs: Job[] = [
    paid("a", 30_000),
    paid("b", 40_000),
    paid("c", 50_000),
    paid("d", 60_000),
    paid("e", 70_000),
    /** A typo, not a salary: it must not move the numbers. */
    paid("f", 11_111_111),
    job({
      id: "g",
      no_experience: true,
      category: "logistica",
      category_label: "Logística y distribución",
      title: "Chofer repartidor",
    }),
    job({ id: "h", date_posted: "2026-01-01T00:00:00", remote: "remote" }),
  ];

  const report = buildMarketReport(jobs, "2026-09-02T00:00:00Z", NOW);

  test("counts what it was given", () => {
    expect(report.count).toBe(8);
    expect(report.noExperience).toBe(1);
  });

  test("an impossible salary is left out of every number", () => {
    expect(report.withSalary).toBe(5);
    expect(report.salary?.max).toBe(70_000);
    expect(report.salary?.median).toBe(50_000);
  });

  test("freshness is counted against the day the report is built", () => {
    expect(report.fresh7).toBe(7);
    expect(report.fresh30).toBe(7);
  });

  test("puestos are grouped and ranked", () => {
    expect(report.roles[0]?.slug).toBe("vendedor");
    expect(report.roles.find((role) => role.slug === "chofer")?.count).toBe(1);
  });

  test("a puesto carries the rubro most of its offers sit in", () => {
    expect(report.roles.find((role) => role.slug === "chofer")?.categoryLabel).toBe(
      "Logística y distribución",
    );
  });

  test("work mode counts a missing remote as on-site", () => {
    expect(report.modes.find((mode) => mode.value === "onsite")?.count).toBe(7);
    expect(report.modes.find((mode) => mode.value === "remote")?.count).toBe(1);
  });

  test("entry-friendly rubros need enough offers to mean anything", () => {
    expect(report.entryFriendly).toEqual([]);
  });
});
