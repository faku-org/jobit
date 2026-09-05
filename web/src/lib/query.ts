import type { JobsQueryOptions } from "./api.ts";
import type { Ranking } from "./ranking.ts";
import { isEmptyRanking } from "./ranking.ts";
import type { Filters, Preferences, Sort, View } from "./types.ts";
import { STATE_SOURCE, hasSalaryPreference } from "./types.ts";

/**
 * Todo lo que decide qué ofertas pide una vista, menos la vista. Está acá y no
 * en App porque la misma cuenta la necesitan dos: la lista que se está
 * mirando y el prefetch de la que se va a tocar.
 */
export interface BoardContext {
  filters: Filters;
  preferences: Preferences;
  ranking: Ranking;
  savedIds: string[];
  discardedIds: string[];
  /** Los portales elegidos; Estado ignora esto y va a su propia fuente. */
  sources: string[];
  /** "Solo similares": la lista se recorta a lo que coincide. */
  similarOnly: boolean;
  /** Solo en Ofertas: mirar la pila de descartadas es una pasada aparte. */
  reviewing: boolean;
}

/** Un id que ninguna oferta tiene, para que una consulta imposible vuelva vacía. */
const NO_MATCH = "none";

/**
 * La lista de guardadas es el orden de la persona, y la de Estado es una
 * carrera contra la fecha de cierre: ninguna de las dos es lugar para que un
 * puntaje opine.
 */
function sortFor(view: View, preferences: Preferences, ranking: Ranking): Sort | undefined {
  if (view === "state") return "closing";
  if (view === "saved") return undefined;
  return preferences.rankByFit && !isEmptyRanking(ranking) ? "match" : undefined;
}

export function jobsQuery(view: View, context: BoardContext): JobsQueryOptions {
  const { filters, preferences, ranking, sources, similarOnly } = context;
  const isSaved = view === "saved";
  const isState = view === "state";
  /** Descartadas se revisan solo desde Ofertas, y ahí se muestran todas,
   * vengan del portal que vengan. */
  const reviewing = context.reviewing && view === "all";
  const sort = sortFor(view, preferences, ranking);

  return {
    filters: { ...filters, category: isSaved ? "" : filters.category },
    ids: isSaved
      ? context.savedIds.length > 0
        ? context.savedIds
        : [NO_MATCH]
      : reviewing
        ? context.discardedIds
        : undefined,
    preferences: similarOnly ? preferences : undefined,
    hiddenCategories: isSaved ? undefined : preferences.hiddenCategories,
    hiddenDepartments: isSaved ? undefined : preferences.hiddenDepartments,
    salary: !isSaved && hasSalaryPreference(preferences.salary) ? preferences.salary : undefined,
    sources: isState ? [STATE_SOURCE] : reviewing ? undefined : sources,
    sort,
    ranking: sort === "match" ? ranking : undefined,
  };
}

/** Las que se pintan con una consulta de ofertas: Seguimiento sale de lo que
 * hay guardado acá y Mercado tiene su propio informe. */
export const BOARD_VIEWS: View[] = ["all", "state", "saved"];
