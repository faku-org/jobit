import { describe, expect, test } from "bun:test";
import { applyEvent, searchEvent } from "./events.ts";
import { EMPTY_FILTERS, type Job } from "./types.ts";

const job: Job = {
  id: "buscojobs:99",
  source: "buscojobs",
  source_id: "99",
  title: "Cajero para supermercado",
  company: "Super",
  department: "Canelones",
  city: "Las Piedras",
  category: "ventas",
  category_label: "Ventas y comercial",
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
  description: "",
  requirements: null,
  apply_url: "https://ejemplo.com/1",
  duplicates: [],
};

describe("searchEvent", () => {
  test("manda el puesto que nombra el texto, no el texto", () => {
    const event = searchEvent({ ...EMPTY_FILTERS, q: "busco de cajera en Maroñas" }, 12);

    expect(event.role).toBe("cajero");
    expect(JSON.stringify(event)).not.toContain("Maroñas");
  });

  test("un texto que no nombra ningún puesto entra como otro", () => {
    expect(searchEvent({ ...EMPTY_FILTERS, q: "algo cerca de casa" }, 3).role).toBe("otro");
  });

  test("lista los filtros puestos, sin sus valores", () => {
    const event = searchEvent(
      { ...EMPTY_FILTERS, q: "cajero", department: "Montevideo", noExperience: true, days: 7 },
      40,
    );

    expect(event.filters).toEqual(["q", "department", "no_experience", "days"]);
    expect(JSON.stringify(event)).not.toContain("Montevideo");
  });

  test("acota el total en vez de mandar cualquier número", () => {
    expect(searchEvent(EMPTY_FILTERS, -5).results).toBe(0);
    expect(searchEvent(EMPTY_FILTERS, 9_999_999).results).toBe(1_000_000);
  });
});

describe("applyEvent", () => {
  test("lleva el aviso y de dónde salió, nada de quien lo abrió", () => {
    expect(applyEvent(job)).toEqual({
      kind: "apply",
      job: "buscojobs:99",
      source: "buscojobs",
      category: "ventas",
    });
  });
});
