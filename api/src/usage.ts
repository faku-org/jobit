import { stat } from "node:fs/promises";
import { CATEGORIES } from "@jobit/worker/categories";
import { ROLES } from "@jobit/worker/roles";
import { eventsFilePath } from "./events.ts";
import { loadFeed } from "./feed.ts";
import { statsFilePath } from "./stats.ts";
import type { Job } from "./types.ts";

/**
 * Lo que se recibió en stats.jsonl y events.jsonl, leído de vuelta y sumado
 * para el panel. Los dos archivos se escriben sin identificador y sin hora, así
 * que acá no hay nada que reconstruir: se cuentan filas, no personas.
 *
 * Es de solo lectura a propósito. El panel mira lo que ya llegó; nada de lo de
 * acá escribe, borra ni corrige lo que hay en disco.
 */

/** Una fila del resumen diario, con los campos que puedan faltar en filas
 * viejas ya resueltos en cero. */
export interface StatsLine {
  day: string;
  education: string;
  degrees: number;
  courses: number;
  experienceYears: number | null;
  saved: number;
  applications: number;
  interviews: number;
  closed: number;
  sources: string[];
}

export type EventLine =
  | {
      day: string;
      kind: "search";
      role: string;
      category: string;
      filters: string[];
      results: number;
    }
  | { day: string; kind: "apply"; job: string; source: string; category: string };

export interface Count {
  value: string;
  count: number;
}

/** Lo mismo, cuando existe un catálogo que le pone nombre al slug. */
export interface Labelled extends Count {
  label: string;
}

export interface JobClicks {
  id: string;
  /** Vacío cuando la oferta ya no está en el tablero: se cayó del scrapeo o se
   * archivó, y el id es lo único que queda de ella. */
  title: string;
  company: string;
  source: string;
  url: string;
  count: number;
}

export interface DayPoint {
  day: string;
  summaries: number;
  searches: number;
  applies: number;
}

export interface UsageReport {
  days: number;
  from: string;
  to: string;
  /** Cuántos resúmenes diarios llegaron: una persona que abre la app tres días
   * manda tres, así que no es gente, es actividad. */
  summaries: number;
  searches: number;
  applies: number;
  saved: number;
  applications: number;
  interviews: number;
  closed: number;
  /** Búsquedas que no devolvieron ni una oferta. Es lo único que dice qué se
   * está buscando y el tablero no tiene. */
  empty: number;
  education: Count[];
  sources: Count[];
  roles: Labelled[];
  emptyRoles: Labelled[];
  filters: Count[];
  categories: Labelled[];
  jobs: JobClicks[];
  daily: DayPoint[];
}

/** "otro" no es un puesto del catálogo: es lo que events.ts escribe cuando lo
 * que se buscó no nombra ninguno, y en el panel se lee como tal. */
const ROLE_LABEL = new Map<string, string>([
  ...ROLES.map((role): [string, string] => [role.slug, role.label]),
  ["otro", "Otro puesto"],
]);
const CATEGORY_LABEL = new Map(CATEGORIES.map((category) => [category.slug, category.label]));

/** Cuántas filas se muestran de cada corte. Más que esto deja de ser una
 * lectura y pasa a ser un volcado del archivo. */
const TOP = 12;

const DAY_MS = 86_400_000;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(Math.round(value), 0) : 0;

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseStatsLine(raw: unknown): StatsLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const day = asString(row.day);
  if (!DAY.test(day)) return null;

  return {
    day,
    education: asString(row.education),
    degrees: asNumber(row.degrees),
    courses: asNumber(row.courses),
    experienceYears:
      typeof row.experience_years === "number" ? asNumber(row.experience_years) : null,
    saved: asNumber(row.saved),
    applications: asNumber(row.applications),
    /** Las filas anteriores a la telemetría de desenlaces no traen estos dos:
     * cuentan como cero, no como una fila inválida. */
    interviews: asNumber(row.interviews),
    closed: asNumber(row.closed),
    sources: asStrings(row.sources),
  };
}

export function parseEventLine(raw: unknown): EventLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const day = asString(row.day);
  if (!DAY.test(day)) return null;

  if (row.kind === "search") {
    return {
      day,
      kind: "search",
      role: asString(row.role),
      category: asString(row.category),
      filters: asStrings(row.filters),
      results: asNumber(row.results),
    };
  }

  if (row.kind === "apply") {
    const job = asString(row.job);
    if (job === "") return null;
    return {
      day,
      kind: "apply",
      job,
      source: asString(row.source),
      category: asString(row.category),
    };
  }

  return null;
}

/**
 * Suma por clave. La clave vacía se descarta salvo que se pida lo contrario: un
 * evento sin rubro no es un rubro llamado "", pero un resumen sin nivel
 * educativo sí es una respuesta, y es la más común mientras nadie completa el
 * perfil.
 */
function tally(values: Iterable<string>, keepEmpty = false): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value === "" && !keepEmpty) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

const ranked = (counts: Map<string, number>, top = TOP): Count[] =>
  [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, top);

const labelled = (
  counts: Map<string, number>,
  labels: Map<string, string>,
  top = TOP,
): Labelled[] =>
  ranked(counts, top).map((row) => ({ ...row, label: labels.get(row.value) ?? row.value }));

const dayOf = (time: number): string => new Date(time).toISOString().slice(0, 10);

/**
 * La ventana se arma con los días completos hacia atrás, hoy incluido, y la
 * serie diaria trae también los días sin nada: un día en cero es un dato, y si
 * se omite la línea lo dibuja como si no hubiera pasado.
 */
export function buildUsageReport(
  stats: StatsLine[],
  events: EventLine[],
  jobs: Job[],
  options: { days: number; today?: Date } = { days: 30 },
): UsageReport {
  const days = Math.max(Math.floor(options.days), 1);
  const end = options.today ?? new Date();
  const to = dayOf(end.getTime());
  const from = dayOf(end.getTime() - (days - 1) * DAY_MS);

  const inWindow = (day: string): boolean => day >= from && day <= to;
  const rows = stats.filter((row) => inWindow(row.day));
  const used = events.filter((event) => inWindow(event.day));
  const searches = used.filter((event) => event.kind === "search");
  const applies = used.filter((event) => event.kind === "apply");

  const daily = new Map<string, DayPoint>();
  for (let index = 0; index < days; index += 1) {
    const day = dayOf(end.getTime() - (days - 1 - index) * DAY_MS);
    daily.set(day, { day, summaries: 0, searches: 0, applies: 0 });
  }
  for (const row of rows) {
    const point = daily.get(row.day);
    if (point) point.summaries += 1;
  }
  for (const event of used) {
    const point = daily.get(event.day);
    if (!point) continue;
    if (event.kind === "search") point.searches += 1;
    else point.applies += 1;
  }

  const byId = new Map(jobs.map((job) => [job.id, job]));
  const clicks = tally(applies.map((event) => event.job));
  const sourceOf = new Map(applies.map((event) => [event.job, event.source]));

  const total = (pick: (row: StatsLine) => number): number =>
    rows.reduce((sum, row) => sum + pick(row), 0);

  return {
    days,
    from,
    to,
    summaries: rows.length,
    searches: searches.length,
    applies: applies.length,
    saved: total((row) => row.saved),
    applications: total((row) => row.applications),
    interviews: total((row) => row.interviews),
    closed: total((row) => row.closed),
    empty: searches.filter((event) => event.results === 0).length,
    education: ranked(
      tally(
        rows.map((row) => row.education),
        true,
      ),
    ),
    sources: ranked(tally(rows.flatMap((row) => row.sources))),
    roles: labelled(tally(searches.map((event) => event.role)), ROLE_LABEL),
    emptyRoles: labelled(
      tally(searches.filter((event) => event.results === 0).map((event) => event.role)),
      ROLE_LABEL,
    ),
    filters: ranked(tally(searches.flatMap((event) => event.filters))),
    categories: labelled(tally(applies.map((event) => event.category)), CATEGORY_LABEL),
    jobs: ranked(clicks).map((row) => {
      const job = byId.get(row.value);
      return {
        id: row.value,
        title: job?.title ?? "",
        company: job?.company ?? "",
        source: job?.source ?? sourceOf.get(row.value) ?? "",
        url: job?.apply_url ?? "",
        count: row.count,
      };
    }),
    daily: [...daily.values()],
  };
}

/**
 * Los .jsonl crecen para siempre, así que se lee la cola y no el archivo
 * entero: lo viejo no entra en ninguna ventana que el panel sepa pedir.
 */
const MAX_BYTES = 4_000_000;

interface FileCache {
  key: string;
  rows: unknown[];
}

const caches = new Map<string, FileCache>();

async function readRows(path: string): Promise<unknown[]> {
  let info: { mtimeMs: number; size: number };
  try {
    info = await stat(path);
  } catch {
    /** Que todavía no exista es el estado normal de un despliegue nuevo. */
    return [];
  }

  const key = `${info.mtimeMs}:${info.size}`;
  const cached = caches.get(path);
  if (cached?.key === key) return cached.rows;

  const file = Bun.file(path);
  const tail = info.size > MAX_BYTES;
  const text = await (tail ? file.slice(info.size - MAX_BYTES).text() : file.text());
  const lines = text.split("\n");
  /** Cortar por bytes parte una línea al medio; esa se descarta entera. */
  if (tail) lines.shift();

  const rows: unknown[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Una línea rota no invalida el archivo: se saltea y sigue.
    }
  }

  caches.set(path, { key, rows });
  return rows;
}

export function clearUsageCache(): void {
  caches.clear();
}

/** Lo que lee el panel: los dos archivos más el tablero, que es lo único que
 * le puede poner título a un id de oferta. */
export async function loadUsage(days: number, today?: Date): Promise<UsageReport> {
  const [stats, events, feed] = await Promise.all([
    readRows(statsFilePath()),
    readRows(eventsFilePath()),
    loadFeed(),
  ]);

  return buildUsageReport(
    stats.map(parseStatsLine).filter((row): row is StatsLine => row !== null),
    events.map(parseEventLine).filter((row): row is EventLine => row !== null),
    /** Sin tablero el panel sigue: las ofertas salen con el id pelado y todo lo
     * demás se cuenta igual. */
    feed.ok ? feed.value.jobs : [],
    { days, today },
  );
}
