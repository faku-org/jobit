import { publishedJobs, version } from "./offers.ts";
import { loadJobs } from "./store.ts";
import type { Job, JobsFile, Result } from "./types.ts";

/**
 * El tablero que ve la gente: lo que scrapeó el worker más lo que se publicó
 * acá, en una sola lista y sin que el filtro, el ranking ni la web tengan que
 * saber de dónde salió cada oferta.
 *
 * Se cachea porque rearmarlo es ordenar dos mil y pico de filas: se rehace
 * solo cuando cambia el archivo del scraper o cuando se toca una oferta
 * propia, no en cada petición.
 */
interface Merged {
  file: JobsFile;
  offersVersion: string;
  value: JobsFile;
}

let cache: Merged | null = null;

/**
 * La versión que se usa cuando la base no está. Las ofertas propias son un
 * agregado; el tablero es el producto. Un disco de solo lectura, un permiso
 * mal puesto o un archivo corrupto tienen que apagar lo propio, no tirar abajo
 * la única página que le importa a alguien que está buscando trabajo.
 *
 * Es una constante y no null para que el caché la trate como cualquier otra
 * versión: mientras la base siga caída no se la consulta de nuevo en cada
 * petición, y cuando el scraper escribe un jobs.json nuevo se reintenta sola.
 */
const NO_DB = "sin-base";

let warned = false;

function safely<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch (cause) {
    /** Una vez y no una por petición: si la base no está, no está seguido. */
    if (!warned) {
      warned = true;
      console.error(
        `[jobit] sin base de ofertas propias, sirviendo solo lo scrapeado: ${String(cause)}`,
      );
    }
    return fallback;
  }
}

/** Las dos listas ya vienen ordenadas por fecha, así que alcanza con
 * intercalarlas en vez de reordenar el total. */
function interleave(own: Job[], scraped: Job[]): Job[] {
  const out: Job[] = [];
  let a = 0;
  let b = 0;

  while (a < own.length && b < scraped.length) {
    const left = own[a];
    const right = scraped[b];
    if (!left || !right) break;
    out.push(left.date_posted >= right.date_posted ? (a++, left) : (b++, right));
  }

  return [...out, ...own.slice(a), ...scraped.slice(b)];
}

export async function loadFeed(): Promise<Result<JobsFile>> {
  const file = await loadJobs();
  if (!file.ok) return file;

  const offersVersion = safely(version, NO_DB);
  if (cache && cache.file === file.value && cache.offersVersion === offersVersion) {
    return { ok: true, value: cache.value };
  }

  const own =
    offersVersion === NO_DB
      ? []
      : safely(
          () => publishedJobs().sort((a, b) => b.date_posted.localeCompare(a.date_posted)),
          [],
        );
  const jobs = own.length === 0 ? file.value.jobs : interleave(own, file.value.jobs);

  const value: JobsFile = {
    ...file.value,
    count: jobs.length,
    sources: own.length > 0 ? [...new Set([...file.value.sources, "jobit"])] : file.value.sources,
    jobs,
  };

  cache = { file: file.value, offersVersion, value };
  return { ok: true, value };
}

export function clearFeedCache(): void {
  cache = null;
  warned = false;
}
