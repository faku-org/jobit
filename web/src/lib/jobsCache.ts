import { MAX_PAGE, fetchJob, fetchJobs, fetchJobsQuery } from "./api.ts";
import { EMPTY_FILTERS, type Job } from "./types.ts";

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

/** Ofertas ya vistas, por id. Sobrevive a que se tire una consulta: abrir una
 * ficha o una fila de seguimiento no tiene por qué volver a la red si esa
 * oferta ya pasó por una lista. */
const byId = new Map<string, Job>();
const jobFlight = new Map<string, Promise<Job>>();

export function rememberJobs(jobs: Job[]): void {
  for (const job of jobs) byId.set(job.id, job);
}

export const readJob = (id: string): Job | undefined => byId.get(id);

export function writeJobs(key: string, jobs: Job[], total: number): void {
  /** Reinsertar la deja última en el orden del Map, que es orden de llegada:
   * así la que se descarta es siempre la que hace más que no se usa. */
  entries.delete(key);
  entries.set(key, { jobs, total, at: Date.now() });
  rememberJobs(jobs);

  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

/**
 * Corrió el scraper: todo lo guardado describe una tanda que ya no está.
 *
 * Las listas se marcan viejas en vez de tirarse. Tirarlas dejaba a la vista sin
 * nada que mostrar y volvía al esqueleto y a la primera página: quien había
 * bajado cuatro páginas las perdía de golpe. Marcadas, la vista sigue pintando
 * lo que hay y revalida atrás la misma profundidad que tenía.
 *
 * El índice por id sí se vacía: una ficha abierta después de esto tiene que
 * traer la versión nueva, no la que estaba guardada.
 */
export function expireJobs(): void {
  for (const entry of entries.values()) entry.at = 0;
  byId.clear();
  jobFlight.clear();
}

/**
 * Una oferta por id. Si ya pasó por una lista, sale de memoria. Si no, se pide
 * y queda para la próxima: el seguimiento abre fichas de a una, y sin esto
 * cada clic espera el round-trip entero.
 */
export function loadJob(id: string, signal?: AbortSignal): Promise<Job> {
  const hit = byId.get(id);
  if (hit) return Promise.resolve(hit);

  const pending = jobFlight.get(id);
  if (pending) return pending;

  const request = fetchJob(id, signal)
    .then((job) => {
      byId.set(job.id, job);
      return job;
    })
    .finally(() => jobFlight.delete(id));
  jobFlight.set(id, request);
  return request;
}

/**
 * Las ofertas detrás de una lista de ids, de una. Lo usa Seguimiento: al
 * apuntar la pestaña ya están, y tocar una fila no espera.
 */
export function prefetchJobIds(ids: readonly string[]): void {
  const missing = [...new Set(ids.filter((id) => id !== "" && !byId.has(id)))];
  if (missing.length === 0) return;

  const key = `ids:${missing.slice().sort().join(",")}`;
  if (inFlight.has(key)) return;

  inFlight.add(key);
  fetchJobs({
    filters: EMPTY_FILTERS,
    ids: missing,
    offset: 0,
    limit: Math.min(missing.length, MAX_PAGE),
  })
    .then((response) => rememberJobs(response.jobs))
    .catch(() => {})
    .finally(() => inFlight.delete(key));
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
