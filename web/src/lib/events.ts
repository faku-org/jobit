import { roleOf } from "@jobit/worker/roles";
import type { Filters, Job } from "./types.ts";

/**
 * Eventos de uso, al lado del resumen diario de stats.ts. Se arman acá, en un
 * solo lugar, por la misma razón: para que lo que se comparte se pueda leer de
 * un vistazo y mostrárselo entero a quien lo comparte.
 *
 * Lo que se escribe en el buscador no sale del navegador: sale el puesto que
 * ese texto nombra, del mismo catálogo con el que se cuentan los avisos, o
 * "otro" cuando no nombra ninguno.
 */
export interface SearchEvent {
  kind: "search";
  role: string;
  category: string;
  filters: string[];
  results: number;
}

/** El id de la oferta, que identifica un aviso público y no a quien lo abrió. */
export interface ApplyEvent {
  kind: "apply";
  job: string;
  source: string;
  category: string;
}

export type UsageEvent = SearchEvent | ApplyEvent;

/** Los nombres de los filtros puestos, sin sus valores: sirve para saber cuáles
 * se usan, no qué buscó nadie en particular. */
function activeFilters(filters: Filters): string[] {
  const names: string[] = [];
  if (filters.q.trim() !== "") names.push("q");
  if (filters.category !== "") names.push("category");
  if (filters.department !== "") names.push("department");
  if (filters.level !== "") names.push("level");
  if (filters.mode !== "") names.push("remote");
  if (filters.jobType !== "") names.push("job_type");
  if (filters.noExperience) names.push("no_experience");
  if (filters.days !== null) names.push("days");
  return names;
}

export function searchEvent(filters: Filters, results: number): SearchEvent {
  return {
    kind: "search",
    role: roleOf(filters.q)?.slug ?? "otro",
    category: filters.category,
    filters: activeFilters(filters),
    results: Math.min(Math.max(Math.round(results), 0), 1_000_000),
  };
}

export const applyEvent = (job: Job): ApplyEvent => ({
  kind: "apply",
  job: job.id,
  source: job.source,
  category: job.category,
});
