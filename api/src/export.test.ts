import { describe, expect, test } from "bun:test";
import { EXPORT_COLUMNS, marketCsv, marketSheets, marketTables } from "./export.ts";
import type { MarketReport, SalarySummary } from "./market.ts";

const salary: SalarySummary = {
  count: 40,
  min: 20_000,
  p25: 30_000,
  median: 45_000,
  p75: 60_000,
  max: 120_000,
};

const report: MarketReport = {
  count: 1200,
  scraped_at: "2026-09-05T06:00:00.000Z",
  fresh7: 300,
  fresh30: 900,
  noExperience: 400,
  withSalary: 40,
  salary,
  sources: [
    { value: "buscojobs", count: 900 },
    { value: "desconocida", count: 300 },
  ],
  roles: [
    {
      slug: "vendedor",
      label: "Vendedor / Vendedora",
      count: 120,
      category: "ventas",
      categoryLabel: "Ventas y comercial",
      noExperience: 60,
      salary,
    },
  ],
  categories: [
    {
      value: "ventas",
      label: "Ventas y comercial",
      count: 300,
      noExperience: 100,
      salary: null,
    },
  ],
  departments: [{ value: "Salto, litoral", count: 40, salary: null }],
  skills: [{ slug: "excel", label: "Excel", count: 80, salary }],
  levels: [{ value: "entry", count: 500 }],
  modes: [{ value: "onsite", count: 1000 }],
  jobTypes: [{ value: "full_time", count: 800 }],
  entryFriendly: [{ value: "ventas", label: "Ventas y comercial", count: 100, share: 0.33 }],
};

const csvRows = (): string[] => marketCsv(report).trimEnd().split("\r\n");

describe("marketTables", () => {
  test("el mercado entero entra en una fila por corte", () => {
    expect(marketTables(report).map((table) => table.name)).toEqual([
      "total",
      "frescura",
      "fuente",
      "puesto",
      "rubro",
      "departamento",
      "habilidad",
      "modalidad",
      "jornada",
      "nivel",
    ]);
  });

  test("los valores cerrados salen con su nombre en español", () => {
    const named = new Map(
      marketTables(report).map((table) => [table.name, table.rows.map((row) => row.etiqueta)]),
    );
    expect(named.get("modalidad")).toEqual(["Presencial"]);
    expect(named.get("jornada")).toEqual(["Jornada completa"]);
    expect(named.get("nivel")).toEqual(["Junior"]);
  });

  test("una fuente que todavía no tiene nombre se dice como viene", () => {
    const fuentes = marketTables(report).find((table) => table.name === "fuente");
    expect(fuentes?.rows.map((row) => row.etiqueta)).toEqual(["BuscoJobs", "desconocida"]);
  });
});

describe("marketCsv", () => {
  test("abre con el encabezado y sigue con el total", () => {
    const [header, total] = csvRows();
    expect(header).toBe(EXPORT_COLUMNS.join(","));
    expect(total).toBe("total,total,Todo el país,,1200,400,40,20000,30000,45000,60000,120000");
  });

  test("cuenta los sueldos publicados aunque no alcancen para un rango", () => {
    const flat: MarketReport = { ...report, salary: null };
    expect(marketCsv(flat)).toContain("total,total,Todo el país,,1200,400,40,,,,,");
  });

  test("el puesto lleva su rubro y el departamento se entrecomilla", () => {
    const rows = csvRows();
    expect(rows).toContain(
      "puesto,vendedor,Vendedor / Vendedora,Ventas y comercial,120,60,40,20000,30000,45000,60000,120000",
    );
    expect(rows).toContain('departamento,"Salto, litoral","Salto, litoral",,40,,,,,,,');
  });
});

describe("marketSheets", () => {
  test("una pestaña por tabla, y el nombre ya dice cuál es", () => {
    const nivel = marketSheets(report).find((sheet) => sheet.name === "nivel");
    expect(nivel?.rows).toEqual([
      ["clave", "etiqueta", "ofertas"],
      ["entry", "Junior", 500],
    ]);
  });

  test("las columnas que esa tabla no usa no ocupan lugar", () => {
    const departamento = marketSheets(report).find((sheet) => sheet.name === "departamento");
    expect(departamento?.rows[0]).toEqual(["clave", "etiqueta", "ofertas"]);
  });

  test("las que sí usa quedan enteras", () => {
    const puesto = marketSheets(report).find((sheet) => sheet.name === "puesto");
    expect(puesto?.rows[0]).toEqual([...EXPORT_COLUMNS].slice(1));
  });
});
