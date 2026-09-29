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

/**
 * Lo que alimenta las métricas de una empresa que publica acá. Lleva solo el
 * id de la oferta, que es público, y viaja por el mismo canal anónimo: no hay
 * usuario ni nada que lo ligue a quien lo mandó.
 */
export interface OfferViewEvent {
  kind: "offer_view";
  id: string;
}

export interface OfferApplyEvent {
  kind: "offer_apply";
  id: string;
}

export type UsageEvent = SearchEvent | ApplyEvent | OfferViewEvent | OfferApplyEvent;

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

/**
 * Solo las ofertas publicadas en JobIt tienen una empresa del otro lado
 * mirando estas cuentas; las scrapeadas no, así que no mandan nada.
 */
export const offerView = (job: Job): OfferViewEvent | null =>
  job.source === "jobit" ? { kind: "offer_view", id: job.id } : null;

export const offerApply = (job: Job): OfferApplyEvent | null =>
  job.source === "jobit" ? { kind: "offer_apply", id: job.id } : null;
