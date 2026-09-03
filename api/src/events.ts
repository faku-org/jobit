import { CATEGORIES } from "@jobit/worker/categories";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { t } from "elysia";
import { ROLES } from "@jobit/worker/roles";

/**
 * Eventos de uso, al lado del resumen diario de stats.ts. La diferencia con
 * aquél es que acá una fila es una acción y no una persona: no hay sesión, no
 * hay orden entre filas de un mismo navegador y no hay nada que permita
 * juntarlas de nuevo.
 *
 * Lo que llega se recorta contra vocabularios que conoce el servidor, así que
 * el archivo nunca guarda texto libre por más que el navegador lo mande: un
 * término de búsqueda entra como el puesto que nombra, o como "otro".
 */
export const eventsSchema = t.Object({
  events: t.Array(
    t.Union([
      t.Object({
        kind: t.Literal("search"),
        role: t.String({ maxLength: 60 }),
        category: t.String({ maxLength: 60 }),
        filters: t.Array(t.String({ maxLength: 20 }), { maxItems: 12 }),
        results: t.Integer({ minimum: 0, maximum: 1_000_000 }),
      }),
      t.Object({
        kind: t.Literal("apply"),
        job: t.String({ maxLength: 100 }),
        source: t.String({ maxLength: 40 }),
        category: t.String({ maxLength: 60 }),
      }),
    ]),
    { maxItems: 20 },
  ),
});

export type EventsBody = typeof eventsSchema.static;
export type UsageEvent = EventsBody["events"][number];

const ROLE_SLUGS = new Set(ROLES.map((role) => role.slug));
const CATEGORY_SLUGS = new Set(CATEGORIES.map((category) => category.slug));
const SOURCES = new Set(["jobit", "buscojobs", "gallito", "uruguayconcursa"]);

/** Los nombres de filtro que entiende /api/jobs, para contar cuáles se usan
 * sin guardar con qué valor. */
const FILTERS = new Set([
  "q",
  "category",
  "department",
  "level",
  "remote",
  "job_type",
  "salary",
  "no_experience",
  "days",
  "sort",
  "source",
]);

const known = (value: string, vocabulary: Set<string>, fallback: string): string =>
  vocabulary.has(value) ? value : fallback;

/** El id de una oferta identifica una oferta, no a quien la miró, así que es
 * lo único que viaja tal cual. Igual se acota por las dudas. */
const JOB_ID = /^[a-z0-9:_-]{1,80}$/i;

function normalise(event: UsageEvent): Record<string, unknown> | null {
  if (event.kind === "search") {
    return {
      kind: "search",
      role: known(event.role, ROLE_SLUGS, "otro"),
      category: known(event.category, CATEGORY_SLUGS, ""),
      filters: [...new Set(event.filters.filter((name) => FILTERS.has(name)))].sort(),
      results: event.results,
    };
  }

  if (!JOB_ID.test(event.job)) return null;
  return {
    kind: "apply",
    job: event.job,
    source: known(event.source, SOURCES, "otra"),
    category: known(event.category, CATEGORY_SLUGS, ""),
  };
}

export const eventsFilePath = (): string =>
  process.env.EVENTS_FILE
    ? resolve(process.env.EVENTS_FILE)
    : resolve(import.meta.dir, "../../data/events.jsonl");

/** Un objeto JSON por línea, con el día y nunca la hora: dos eventos del mismo
 * navegador quedan indistinguibles de dos de navegadores distintos. */
export async function appendEvents(events: UsageEvent[]): Promise<number> {
  const rows = events.map(normalise).filter((row) => row !== null);
  if (rows.length === 0) return 0;

  const path = eventsFilePath();
  await mkdir(dirname(path), { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const lines = rows.map((row) => `${JSON.stringify({ day, ...row })}\n`).join("");
  await appendFile(path, lines, "utf8");
  return rows.length;
}
