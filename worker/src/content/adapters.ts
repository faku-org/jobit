import { contentId, type ContentItem, type ContentSource } from "./types.ts";

/**
 * Los adapters de ingesta: convierten una fuente base en ítems.
 *
 * Son deliberadamente chicos y sin dependencias (el mismo criterio que
 * `worker/src/egress.ts`): alcanza con leer RSS, listar enlaces de una página o
 * un sitemap, y mapear un JSON. No se guarda la página ajena: se guarda su
 * título, un resumen y el enlace, que es lo que corresponde republicar.
 */
export interface AdapterContext {
  fetchImpl: typeof fetch;
  /** Día de la corrida, ISO `YYYY-MM-DD`. */
  now: string;
  userAgent: string;
}

const MAX_TITLE = 160;
const MAX_BODY = 600;
const DEFAULT_LIMIT = 40;
const TIMEOUT_MS = 20_000;

const configValue = (source: ContentSource, key: string): string | undefined => {
  const value = source.config?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const configNumber = (source: ContentSource, key: string): number | undefined => {
  const raw = configValue(source, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

/** El texto que se muestra: sin etiquetas, sin entidades y sin espacios de más. */
export function plainText(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const clamp = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

const tag = (xml: string, name: string): string | undefined => {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  const value = match?.[1];
  return value === undefined ? undefined : plainText(value);
};

/** El `<link>` de un RSS es texto; el de un Atom es un atributo `href`. */
const entryLink = (entry: string): string | undefined => {
  const attribute = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(entry);
  if (attribute?.[1]) return attribute[1];
  return tag(entry, "link");
};

async function fetchText(url: string, ctx: AdapterContext): Promise<string> {
  const response = await ctx.fetchImpl(url, {
    headers: { "user-agent": ctx.userAgent, accept: "*/*" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status} en ${url}`);
  return response.text();
}

function makeItem(
  source: ContentSource,
  ctx: AdapterContext,
  fields: { title: string; body: string; url: string | null; tags: string[] },
): ContentItem {
  return {
    id: contentId(source.id, fields.url, fields.title),
    kind: source.kind,
    title: clamp(fields.title, MAX_TITLE),
    body: clamp(fields.body, MAX_BODY),
    url: fields.url,
    source: source.id,
    source_label: source.label,
    license: source.license ?? null,
    sponsored: source.sponsored ?? false,
    categories: source.categories,
    roles: source.roles ?? [],
    level: null,
    tags: fields.tags,
    fetched_at: ctx.now,
  };
}

async function collectRss(source: ContentSource, ctx: AdapterContext): Promise<ContentItem[]> {
  const feed = configValue(source, "feed");
  if (!feed) throw new Error("falta config.feed");

  const xml = await fetchText(feed, ctx);
  const entries = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(
    (match) => match[0] ?? "",
  );
  const tags = [configValue(source, "tag") ?? "recurso"];

  return entries.flatMap((entry) => {
    const title = tag(entry, "title");
    if (!title) return [];
    const link = entryLink(entry);
    const body = tag(entry, "description") ?? tag(entry, "summary") ?? tag(entry, "content") ?? "";
    return [makeItem(source, ctx, { title, body, url: link ?? null, tags })];
  });
}

/** Enlaces de una página o de un sitemap, filtrados por `config.pattern`. */
async function collectLinks(source: ContentSource, ctx: AdapterContext): Promise<ContentItem[]> {
  const page = configValue(source, "page") ?? source.base;
  const limit = configNumber(source, "limit") ?? DEFAULT_LIMIT;
  const filters = configValue(source, "pattern");

  const html = await fetchText(page, ctx);
  const raw = [
    ...[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1] ?? ""),
    ...[...html.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1] ?? ""),
  ];

  const seen = new Set<string>();
  const items: ContentItem[] = [];
  const tags = [configValue(source, "tag") ?? "recurso"];

  for (const href of raw) {
    let url: URL;
    try {
      url = new URL(href, source.base);
    } catch {
      continue;
    }
    /** Solo lo del propio sitio: una fuente no trae enlaces de terceros. */
    if (url.origin !== new URL(source.base).origin) continue;
    if (filters && !new RegExp(filters).test(url.pathname)) continue;
    if (seen.has(url.pathname)) continue;
    seen.add(url.pathname);

    const segment = url.pathname.split("/").filter(Boolean).pop() ?? url.pathname;
    const title = plainText(segment.replace(/\.(html?|php|aspx?)$/i, "").replace(/[-_]+/g, " "));
    if (!title) continue;

    items.push(makeItem(source, ctx, { title, body: "", url: url.href, tags }));
    if (items.length >= limit) break;
  }

  return items;
}

const readPath = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);

async function collectJson(source: ContentSource, ctx: AdapterContext): Promise<ContentItem[]> {
  const url = configValue(source, "url");
  if (!url) throw new Error("falta config.url");

  const payload: unknown = await (
    await ctx.fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  ).json();
  const list = readPath(payload, configValue(source, "items") ?? "items");
  if (!Array.isArray(list)) throw new Error("config.items no apunta a una lista");

  const titleField = configValue(source, "title") ?? "title";
  const linkField = configValue(source, "link") ?? "url";
  const bodyField = configValue(source, "body") ?? "description";
  const tags = [configValue(source, "tag") ?? "recurso"];

  return list.flatMap((entry) => {
    const title = readPath(entry, titleField);
    if (typeof title !== "string" || title === "") return [];
    const link = readPath(entry, linkField);
    const body = readPath(entry, bodyField);
    return [
      makeItem(source, ctx, {
        title,
        body: typeof body === "string" ? plainText(body) : "",
        url: typeof link === "string" ? link : null,
        tags,
      }),
    ];
  });
}

export function collect(source: ContentSource, ctx: AdapterContext): Promise<ContentItem[]> {
  switch (source.adapter) {
    case "rss":
      return collectRss(source, ctx);
    case "links":
      return collectLinks(source, ctx);
    case "json":
      return collectJson(source, ctx);
    case "manual":
      return Promise.resolve([]);
  }
}
