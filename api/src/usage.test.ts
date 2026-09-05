import { describe, expect, test } from "bun:test";
import {
  type EventLine,
  type StatsLine,
  buildUsageReport,
  parseEventLine,
  parseStatsLine,
} from "./usage.ts";
import type { Job } from "./types.ts";

const TODAY = new Date("2026-09-04T12:00:00Z");

const stats = (over: Partial<StatsLine> = {}): StatsLine => ({
  day: "2026-09-04",
  education: "secondary",
  degrees: 0,
  courses: 0,
  experienceYears: null,
  saved: 0,
  applications: 0,
  interviews: 0,
  closed: 0,
  sources: [],
  ...over,
});

const search = (over: Partial<Extract<EventLine, { kind: "search" }>> = {}): EventLine => ({
  day: "2026-09-04",
  kind: "search",
  role: "cajero",
  category: "ventas",
  filters: ["q"],
  results: 12,
  ...over,
});

const apply = (over: Partial<Extract<EventLine, { kind: "apply" }>> = {}): EventLine => ({
  day: "2026-09-04",
  kind: "apply",
  job: "buscojobs:99",
  source: "buscojobs",
  category: "ventas",
  ...over,
});

const job = (over: Partial<Job> & Pick<Job, "id">): Job => ({
  source: "buscojobs",
  source_id: "99",
  title: "Cajero para supermercado",
  company: "Empresa SA",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-01T00:00:00",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: 0,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: 1,
  closes_at: null,
  description: "",
  requirements: null,
  apply_url: "https://www.buscojobs.com.uy/x-ID-99",
  duplicates: [],
  ...over,
});

describe("parseStatsLine", () => {
  test("las filas viejas sin desenlaces cuentan cero, no se descartan", () => {
    const row = parseStatsLine({
      day: "2026-09-02",
      education: "",
      degrees: 0,
      courses: 0,
      experience_years: null,
      saved: 3,
      applications: 0,
      sources: [],
    });

    expect(row?.saved).toBe(3);
    expect(row?.interviews).toBe(0);
    expect(row?.closed).toBe(0);
  });

  test("sin un día bien escrito no hay fila", () => {
    expect(parseStatsLine({ day: "ayer", saved: 3 })).toBeNull();
    expect(parseStatsLine(null)).toBeNull();
    expect(parseStatsLine("{}")).toBeNull();
  });
});

describe("parseEventLine", () => {
  test("distingue los dos tipos y descarta lo que no sea ninguno", () => {
    expect(
      parseEventLine({ day: "2026-09-04", kind: "search", role: "cajero", results: 3 })?.kind,
    ).toBe("search");
    expect(parseEventLine({ day: "2026-09-04", kind: "apply", job: "jobit:1" })?.kind).toBe(
      "apply",
    );
    expect(parseEventLine({ day: "2026-09-04", kind: "otro" })).toBeNull();
    expect(parseEventLine({ day: "2026-09-04", kind: "apply", job: "" })).toBeNull();
  });
});

describe("buildUsageReport", () => {
  test("suma los resúmenes diarios de la ventana", () => {
    const report = buildUsageReport(
      [
        stats({ saved: 3, applications: 2, interviews: 1, closed: 1 }),
        stats({ day: "2026-09-03", saved: 1, applications: 1 }),
      ],
      [],
      [],
      { days: 30, today: TODAY },
    );

    expect(report.summaries).toBe(2);
    expect(report.saved).toBe(4);
    expect(report.applications).toBe(3);
    expect(report.interviews).toBe(1);
    expect(report.closed).toBe(1);
  });

  test("deja afuera lo que cayó antes de la ventana", () => {
    const report = buildUsageReport(
      [stats({ day: "2026-08-01", saved: 9 }), stats({ saved: 1 })],
      [search({ day: "2026-08-01" }), search()],
      [],
      { days: 7, today: TODAY },
    );

    expect(report.from).toBe("2026-08-29");
    expect(report.to).toBe("2026-09-04");
    expect(report.summaries).toBe(1);
    expect(report.saved).toBe(1);
    expect(report.searches).toBe(1);
  });

  test("cuenta las búsquedas que no devolvieron nada, por puesto", () => {
    const report = buildUsageReport(
      [],
      [
        search({ role: "sushiman", results: 0 }),
        search({ role: "sushiman", results: 0 }),
        search({ role: "cajero", results: 40 }),
      ],
      [],
      { days: 30, today: TODAY },
    );

    expect(report.searches).toBe(3);
    expect(report.empty).toBe(2);
    expect(report.emptyRoles[0]).toEqual({ value: "sushiman", label: "sushiman", count: 2 });
    expect(report.roles[0]?.count).toBe(2);
  });

  test("le pone título a la oferta clickeada, y aguanta que ya no esté", () => {
    const report = buildUsageReport(
      [],
      [apply(), apply(), apply({ job: "buscojobs:vieja" })],
      [job({ id: "buscojobs:99" })],
      { days: 30, today: TODAY },
    );

    expect(report.applies).toBe(3);
    expect(report.jobs[0]).toEqual({
      id: "buscojobs:99",
      title: "Cajero para supermercado",
      company: "Empresa SA",
      source: "buscojobs",
      url: "https://www.buscojobs.com.uy/x-ID-99",
      count: 2,
    });
    /** La que se cayó del tablero queda con el id y la fuente del evento. */
    expect(report.jobs[1]).toMatchObject({ id: "buscojobs:vieja", title: "", source: "buscojobs" });
  });

  test("la serie diaria trae todos los días, también los que no tuvieron nada", () => {
    const report = buildUsageReport([stats()], [search(), apply()], [], {
      days: 3,
      today: TODAY,
    });

    expect(report.daily).toHaveLength(3);
    expect(report.daily[0]).toEqual({
      day: "2026-09-02",
      summaries: 0,
      searches: 0,
      applies: 0,
    });
    expect(report.daily[2]).toEqual({
      day: "2026-09-04",
      summaries: 1,
      searches: 1,
      applies: 1,
    });
  });

  test("el nivel sin cargar cuenta como respuesta, el rubro vacío no", () => {
    const report = buildUsageReport(
      [stats({ education: "" }), stats({ education: "" }), stats({ education: "university" })],
      [search({ role: "otro", category: "" })],
      [],
      { days: 30, today: TODAY },
    );

    expect(report.education).toEqual([
      { value: "", count: 2 },
      { value: "university", count: 1 },
    ]);
    expect(report.roles).toEqual([{ value: "otro", label: "Otro puesto", count: 1 }]);
    expect(report.categories).toEqual([]);
  });

  test("los rubros y los filtros salen ordenados por uso, sin las claves vacías", () => {
    const report = buildUsageReport(
      [],
      [
        search({ filters: ["q", "category"] }),
        search({ filters: ["q"] }),
        apply({ category: "tecnologia" }),
        apply({ category: "tecnologia" }),
        apply({ category: "" }),
      ],
      [],
      { days: 30, today: TODAY },
    );

    expect(report.filters).toEqual([
      { value: "q", count: 2 },
      { value: "category", count: 1 },
    ]);
    /** El rubro sale de los clicks en postular y no de las búsquedas: es el
     * rubro que alguien eligió, no el que estaba filtrando. */
    expect(report.categories).toEqual([{ value: "tecnologia", label: "Tecnología", count: 2 }]);
  });
});
