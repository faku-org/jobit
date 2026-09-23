import { describe, expect, test } from "bun:test";
import { boardView, formatMarket, localViewMessage, withBoardView } from "./cli.ts";
import type { MarketReport, SalarySummary } from "./market.ts";

describe("boardView", () => {
  test("las secciones del tablero pasan, el resto cae al listado", () => {
    expect(boardView("state")).toBe("state");
    expect(boardView("market")).toBe("market");
    expect(boardView("saved")).toBe("saved");
    expect(boardView("tracking")).toBe("tracking");
    expect(boardView("all")).toBe("all");
    expect(boardView("inventada")).toBe("all");
    expect(boardView(undefined)).toBe("all");
  });
});

describe("withBoardView", () => {
  test("Estado fija la fuente y ordena por cierre", () => {
    expect(withBoardView({}, "state")).toEqual({ source: "uruguayconcursa", sort: "closing" });
  });

  test("un sort explícito se respeta", () => {
    expect(withBoardView({ sort: "recent" as const }, "state").sort).toBe("recent");
  });

  test("las demás secciones no tocan la consulta", () => {
    const query = { source: "buscojobs", sort: "match" as const };
    expect(withBoardView(query, "all")).toBe(query);
    expect(withBoardView(query, "market")).toBe(query);
  });
});

describe("localViewMessage", () => {
  test("guardadas y seguimiento explican que no hay nada en el servidor", () => {
    const saved = localViewMessage("saved");
    expect(saved).toContain("viven en el navegador");
    expect(saved).toContain("?view=state");
    expect(localViewMessage("tracking")).toBe(saved);
    expect(localViewMessage("all")).toBeNull();
    expect(localViewMessage("state")).toBeNull();
  });
});

describe("formatMarket", () => {
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
    categories: [{ value: "ventas", label: "Ventas y comercial", count: 800, noExperience: 200, salary }],
    departments: [{ value: "Montevideo", count: 700, salary }],
    levels: [],
    modes: [],
    jobTypes: [],
    entryFriendly: [],
  };

  test("encabezado, cortes y dónde bajar el informe entero", () => {
    const text = formatMarket(report);
    expect(text.startsWith("JobIt mercado · 1200 ofertas · 2026-09-05\n")).toBe(true);
    expect(text).toContain("400 sin experiencia previa");
    expect(text).toContain("mediana $45.000");
    expect(text).toContain("BuscoJobs");
    expect(text).toContain("desconocida");
    expect(text).toContain("Vendedor / Vendedora");
    expect(text).toContain("Ventas y comercial");
    expect(text).toContain("Montevideo");
    expect(text).toContain("/api/market.csv");
    expect(text.endsWith("\n")).toBe(true);
  });

  test("recorta los puestos cuando hay de más", () => {
    const roles = Array.from({ length: 22 }, (_, index) => ({
      slug: `r${index}`,
      label: `Puesto ${index}`,
      count: 22 - index,
      category: "ventas",
      categoryLabel: "Ventas",
      noExperience: 0,
      salary: null,
    }));
    const text = formatMarket({ ...report, roles });
    expect(text).toContain("Puesto 0");
    expect(text).toContain("Puesto 19");
    expect(text).not.toContain("Puesto 20");
    expect(text).toContain("… 2 más");
  });
});
