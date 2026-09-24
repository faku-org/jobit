/**
 * El contenido que JobIt trae y cura, aparte de las ofertas.
 *
 * Lo que calcula el tablero (ofertas, mercado, ranking) se regenera solo. Esto
 * es lo contrario: texto que hay que buscar y mantener, por rubro y por puesto,
 * y que después se aplica al contenido relacionado (una oferta de tecnología
 * muestra las preguntas de tecnología; confirmar una postulación muestra los
 * ejercicios de esa área).
 *
 * El vocabulario de `categories` y `roles` es el mismo del tablero
 * (`worker/src/categories.ts` y `worker/src/roles.ts`), para que "Programador"
 * signifique lo mismo en todo el sistema.
 */
export type ContentKind =
  | "faq" // preguntas frecuentes de entrevista
  | "topic" // habilidades y temas por rubro
  | "exercise" // ejercicios de práctica
  | "resource" // cursos, documentación, podcasts, videos
  | "context"; // noticias, entrevistas y decisiones recientes

export const CONTENT_KINDS: ContentKind[] = ["faq", "topic", "exercise", "resource", "context"];

export type ContentLevel = "entry" | "mid" | "senior";

export interface ContentItem {
  /** Estable: el mismo contenido no se duplica al reingerir. */
  id: string;
  kind: ContentKind;
  title: string;
  /** Texto corto o markdown; nunca la página ajena entera. */
  body: string;
  /** La fuente original, para enlazar y para acreditar. */
  url: string | null;
  source: string;
  source_label: string;
  license: string | null;
  /** true → la web emite rel="sponsored". Los enlaces pagos se marcan siempre. */
  sponsored: boolean;
  /** Slugs de rubro (`worker/src/categories.ts`). */
  categories: string[];
  /** Slugs de puesto (`worker/src/roles.ts`). */
  roles: string[];
  level: ContentLevel | null;
  tags: string[];
  fetched_at: string;
}

/** Lo que el worker escribe en `worker/output/content.json`. */
export interface FetchedContent {
  fetched_at: string;
  items: ContentItem[];
}

/**
 * Una fuente base: de dónde se trae y cómo leerlo. El `config` lo interpreta
 * cada adapter (el feed a leer, el patrón de links, las claves del JSON).
 */
export interface ContentSource {
  id: string;
  label: string;
  /** URL base, para resolver enlaces relativos y para saber el origen. */
  base: string;
  /** Qué es lo que trae, por defecto; el adapter puede afinarlo. */
  kind: ContentKind;
  adapter: "rss" | "links" | "json" | "manual";
  categories: string[];
  roles?: string[];
  sponsored?: boolean;
  license?: string | null;
  config?: Record<string, string>;
}

/**
 * Hash FNV-1a de `source|url` (o el título cuando no hay url). Alcanza para
 * deduplicar y es estable entre corridas sin depender de un id que la fuente
 * no da.
 */
export function contentId(source: string, url: string | null, title: string): string {
  const key = `${source}|${url ?? title}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${source}:${(hash >>> 0).toString(16)}`;
}

const isKind = (value: unknown): value is ContentKind =>
  typeof value === "string" && (CONTENT_KINDS as readonly string[]).includes(value);

/** Una fila leída del disco se acepta solo si tiene lo mínimo para mostrarse. */
export function isContentItem(value: unknown): value is ContentItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    isKind(item.kind) &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.source === "string" &&
    Array.isArray(item.categories)
  );
}
