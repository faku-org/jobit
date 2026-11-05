import { describe, expect, test } from "bun:test";
import { employerFacets, employerKey, employerProfile, employerSlug } from "./employers.ts";
import { filterJobs } from "./filter.ts";
import type { Job } from "./types.ts";

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "job-1",
  source: "buscojobs",
  source_id: "1",
  title: "Vendedor de mostrador",
  company: "ACME S.A.",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-01",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: { min: 30_000, max: 40_000, currency: "UYU" },
  experience_years_min: null,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "",
  requirements: null,
  apply_url: "https://x.test/a",
  duplicates: [],
  ...overrides,
});

describe("employerKey y slug", () => {
  test("agrupan sin acentos ni mayúsculas", () => {
    expect(employerKey("  TATA   Services ")).toBe("tata services");
    expect(employerSlug("TATA Services")).toBe("tata-services");
    expect(employerSlug("Telefónica")).toBe("telefonica");
  });
});

describe("employerFacets", () => {
  test("agrupa por empresa y muestra la forma más repetida", () => {
    const jobs = [
      job({ company: "ACME S.A.", id: "a" }),
      job({ company: "Acme S.A.", id: "b" }),
      job({ company: "TATA", id: "c", category: "tecnologia" }),
    ];
    const facets = employerFacets(jobs, undefined);
    expect(facets).toEqual([
      { value: "acme-s-a", label: "ACME S.A.", count: 2 },
      { value: "tata", label: "TATA", count: 1 },
    ]);
  });

  test("con rubro, solo las empresas de ese rubro", () => {
    const jobs = [
      job({ company: "ACME", id: "a", category: "ventas" }),
      job({ company: "TATA", id: "b", category: "tecnologia" }),
    ];
    expect(employerFacets(jobs, "tecnologia").map((entry) => entry.value)).toEqual(["tata"]);
  });

  test("las ofertas sin empresa no cuentan", () => {
    expect(employerFacets([job({ company: null })], undefined)).toEqual([]);
  });
});

describe("employerProfile", () => {
  const jobs = [
    job({ id: "1", company: "ACME", title: "Vendedor", date_posted: "2026-09-01" }),
    job({ id: "2", company: "ACME", title: "Vendedor", date_posted: "2026-09-03" }),
    job({
      id: "3",
      company: "ACME",
      title: "Cajero",
      date_posted: "2026-09-02",
      category: "atencion-cliente",
    }),
    job({ id: "4", company: "Otra", title: "Cajero" }),
  ];

  test("resume la empresa y no la mezcla con otras", () => {
    const profile = employerProfile(jobs, "acme");
    expect(profile?.label).toBe("ACME");
    expect(profile?.count).toBe(3);
    expect(profile?.roles.map((role) => role.slug).sort()).toEqual(["cajero", "vendedor"]);
    expect(profile?.latest).toEqual(["2", "3", "1"]);
  });

  test("una empresa que no está da null", () => {
    expect(employerProfile(jobs, "no-existe")).toBeNull();
  });
});

describe("filtro por empresa", () => {
  const jobs = [
    job({ id: "a", company: "ACME" }),
    job({ id: "b", company: "TATA Services" }),
    job({ id: "c", company: null }),
  ];

  test("matchea por slug", () => {
    const found = filterJobs(jobs, {
      employers: new Set(["tata-services"]),
      limit: 50,
      offset: 0,
    });
    expect(found.jobs.map((entry) => entry.id)).toEqual(["b"]);
  });

  test("varias empresas a la vez", () => {
    const found = filterJobs(jobs, {
      employers: new Set(["acme", "tata-services"]),
      limit: 50,
      offset: 0,
    });
    expect(found.total).toBe(2);
  });
});
