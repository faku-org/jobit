import { describe, expect, test } from "bun:test";
import { formatJob, formatJobs } from "./raw.ts";
import type { Job, JobsResponse } from "./types.ts";

const job = (overrides: Partial<Job> & Pick<Job, "id">): Job => ({
  source: "buscojobs",
  source_id: overrides.id,
  title: "Cajero de mostrador",
  company: "Empresa SA",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-04T00:00:00.000Z",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: null,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "Atención al público.\nTurnos rotativos.",
  requirements: null,
  apply_url: `https://ejemplo.com/${overrides.id}`,
  duplicates: [],
  ...overrides,
});

describe("formatJob", () => {
  test("tres líneas: puesto, dónde, enlace", () => {
    expect(formatJob(job({ id: "a" }))).toBe(
      [
        "Cajero de mostrador",
        "Empresa SA · Montevideo · Ventas y comercial",
        "https://ejemplo.com/a",
      ].join("\n"),
    );
  });

  test("sin empresa no deja el punto colgando", () => {
    expect(formatJob(job({ id: "a", company: null })).split("\n")[1]).toBe(
      "Montevideo · Ventas y comercial",
    );
  });

  test("el detalle agrega la descripción, el listado no", () => {
    const offer = job({ id: "a" });
    expect(formatJob(offer)).not.toContain("Atención al público");
    expect(formatJob(offer, true)).toContain("Turnos rotativos.");
  });
});

describe("formatJobs", () => {
  test("el encabezado dice la rebanada y el total", () => {
    const response: JobsResponse = {
      total: 12,
      offset: 10,
      limit: 50,
      jobs: [job({ id: "a" }), job({ id: "b", title: "Repositor" })],
    };
    const text = formatJobs(response);
    expect(text.startsWith("JobIt 11-12 de 12\n\n")).toBe(true);
    expect(text).toContain("Repositor");
    expect(text.endsWith("\n")).toBe(true);
  });

  test("sin ofertas no inventa un rango", () => {
    expect(formatJobs({ total: 0, offset: 0, limit: 50, jobs: [] })).toBe("JobIt 0-0 de 0\n");
  });
});
