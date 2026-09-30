import { describe, expect, test } from "bun:test";
import { buildMarketReport } from "./market.ts";
import type { Job } from "./types.ts";

const job = (id: string, description: string): Job => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: "Aviso",
  company: "Acme",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-01T00:00:00.000Z",
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description,
  requirements: null,
  apply_url: "",
  duplicates: [],
});

describe("el corte de habilidades", () => {
  test("cuenta las que más se piden", () => {
    const report = buildMarketReport(
      [
        job("1", "Excel y atención al cliente"),
        job("2", "Excel avanzado"),
        job("3", "Atención al cliente"),
        job("4", "Excel"),
        job("5", "Excel e inglés"),
        job("6", "Excel intermedio"),
      ],
      "2026-09-01",
    );

    const excel = report.skills.find((skill) => skill.slug === "excel");
    expect(excel?.count).toBe(5);
    expect(report.skills[0]?.slug).toBe("excel");
  });

  test("una habilidad mencionada en menos de cinco avisos no aparece", () => {
    expect(buildMarketReport([job("1", "Inglés avanzado")], "2026-09-01").skills).toEqual([]);
  });
});
