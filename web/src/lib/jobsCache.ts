import { fetchJobsQuery } from "./api.ts";
import type { Job } from "./types.ts";

export interface CachedJobs {
  jobs: Job[];
  total: number;
  /** Cuándo se trajo, para saber si todavía sirve sin volver a preguntar. */
  at: number;
}

/**
 * Lo que ya se trajo, por consulta. Cambiar de pestaña y volver no vuelve a
 * empezar: se pinta lo guardado y recién ahí, si quedó viejo, se revalida de
 * fondo. Vive en memoria y muere con la pestaña, que es lo que se quiere: no
 * es un dato del navegador, es lo que se está mirando ahora.
 */
const entries = new Map<string, CachedJobs>();

/** La tanda de ofertas cambia cuando corre el scraper, una vez por día: cinco
 * minutos alcanza de sobra para que ir y volver de una pestaña sea gratis. */
const FRESH_MS = 5 * 60_000;

/** Cada combinación de filtros deja una entrada; un rato de tocar chips llena
 * esto, así que se tiran las más viejas primero. */
const MAX_ENTRIES = 24;

export const isStale = (entry: CachedJobs): boolean => Date.now() - entry.at > FRESH_MS;

export const readJobs = (key: string): CachedJobs | undefined => entries.get(key);

export function writeJobs(key: string, jobs: Job[], total: number): void {
  /** Reinsertar la deja última en el orden del Map, que es orden de llegada:
   * así la que se descarta es siempre la que hace más que no se usa. */
  entries.delete(key);
  entries.set(key, { jobs, total, at: Date.now() });

  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

/** Lo que ya se está pidiendo, para que dos prefetch de lo mismo sean uno. */
const inFlight = new Set<string>();

/**
 * Trae la primera página de una consulta antes de que alguien la mire: al
 * pasar el mouse por una pestaña y en el rato muerto después de la primera
 * lista. Para cuando se toca, ya está.
 *
 * Solo llena lo que falta. Refrescar lo que ya está guardado es cosa de la
 * vista, que sabe cuántas páginas tenía cargadas; desde acá le estaríamos
 * recortando la lista a la primera página sin que nadie lo pidiera.
 */
export function prefetchJobs(key: string): void {
  if (key === "" || inFlight.has(key) || entries.has(key)) return;

  inFlight.add(key);
  fetchJobsQuery(key)
    .then((response) => writeJobs(key, response.jobs, response.total))
    /** Un prefetch que falla no es un error de nadie: la vista lo va a pedir
     * de nuevo cuando se abra, y ahí sí hay a quién avisarle. */
    .catch(() => {})
    .finally(() => inFlight.delete(key));
}
