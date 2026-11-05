import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { SEED_ITEMS } from "@jobit/worker/content/seed";
import {
  CONTENT_KINDS,
  type ContentItem,
  type ContentKind,
  isContentItem,
} from "@jobit/worker/content/types";
import type { Result } from "./types.ts";

/**
 * El contenido curado (FAQ, ejercicios, recursos) que la web muestra al lado de
 * las ofertas. No se calcula: se trae con `bun run --cwd worker content` y se
 * mezcla con el seed versionado, así que el archivo traído es un agregado y
 * nunca la única fuente.
 *
 * Se cachea por mtime, igual que el JSON del scraper: una corrida nueva se ve
 * sin reiniciar la API.
 */
const DEFAULT_PATH = resolve(import.meta.dir, "../../worker/output/content.json");

export const contentFilePath = (): string =>
  process.env.CONTENT_FILE ? resolve(process.env.CONTENT_FILE) : DEFAULT_PATH;

interface Cache {
  mtimeMs: number;
  items: ContentItem[];
}

let cache: Cache | null = null;
let warned = false;

export function parseContentFile(raw: unknown): Result<ContentItem[]> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "el archivo de contenido no es un objeto" };
  }
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || !items.every(isContentItem)) {
    return { ok: false, error: 'el archivo de contenido no tiene un array "items" válido' };
  }
  return { ok: true, value: items as ContentItem[] };
}

/** Seed + traído, sin repetir por id. Lo traído pisa al seed si coincide. */
export function mergeContent(...groups: ContentItem[][]): ContentItem[] {
  const byId = new Map<string, ContentItem>();
  for (const group of groups) for (const item of group) byId.set(item.id, item);
  return [...byId.values()];
}

function seedOnly(cause: unknown): Result<ContentItem[]> {
  if (!warned) {
    warned = true;
    console.error(`[jobit] sin contenido traído, sirviendo solo el seed: ${String(cause)}`);
  }
  return { ok: true, value: mergeContent(SEED_ITEMS) };
}

export async function loadContent(): Promise<Result<ContentItem[]>> {
  const path = contentFilePath();

  let mtimeMs: number;
  try {
    mtimeMs = (await stat(path)).mtimeMs;
  } catch {
    /** No hay archivo traído: el seed alcanza para que la función ande. */
    return { ok: true, value: mergeContent(SEED_ITEMS) };
  }

  if (cache && cache.mtimeMs === mtimeMs) return { ok: true, value: cache.items };

  let raw: unknown;
  try {
    raw = await Bun.file(path).json();
  } catch (cause) {
    return seedOnly(cause);
  }

  const parsed = parseContentFile(raw);
  if (!parsed.ok) return seedOnly(parsed.error);

  const items = mergeContent(SEED_ITEMS, parsed.value);
  cache = { mtimeMs, items };
  return { ok: true, value: items };
}

export function clearContentCache(): void {
  cache = null;
  warned = false;
}

/** Las preguntas primero, lo de contexto al final: es el orden de lectura. */
const KIND_RANK: Record<ContentKind, number> = {
  faq: 0,
  topic: 1,
  exercise: 2,
  resource: 3,
  context: 4,
};

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function matchesText(item: ContentItem, needle: string): boolean {
  const haystack = normalize([item.title, item.body, item.tags.join(" ")].join(" "));
  return normalize(needle)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export interface ContentQuery {
  kinds?: Set<ContentKind>;
  category?: string;
  role?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface ContentPage {
  total: number;
  offset: number;
  limit: number;
  items: ContentItem[];
}

export function queryContent(items: ContentItem[], query: ContentQuery): ContentPage {
  const found = items.filter((item) => {
    if (query.kinds && !query.kinds.has(item.kind)) return false;
    if (query.category && !item.categories.includes(query.category)) return false;
    if (query.role && !item.roles.includes(query.role)) return false;
    if (query.q && !matchesText(item, query.q)) return false;
    return true;
  });

  const sorted = [...found].sort(
    (a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.title.localeCompare(b.title),
  );

  return {
    total: sorted.length,
    offset: query.offset,
    limit: query.limit,
    items: sorted.slice(query.offset, query.offset + query.limit),
  };
}

export const isContentKind = (value: string): value is ContentKind =>
  (CONTENT_KINDS as readonly string[]).includes(value);
