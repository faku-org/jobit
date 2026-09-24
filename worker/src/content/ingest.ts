import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { collect } from "./adapters.ts";
import { CONTENT_SOURCES } from "./sources.ts";
import { type ContentItem, type FetchedContent, isContentItem } from "./types.ts";

/**
 * La ingesta: lee `sources.ts`, aplica el adapter de cada fuente y escribe
 * `worker/output/content.json`. La API mezcla ese archivo con el seed, así que
 * esto solo agrega; nunca es la única fuente de contenido.
 *
 * Si una fuente falla, se conservan los ítems que esa misma fuente había dejado
 * en la corrida anterior, igual que el worker de ofertas: una caída de red no
 * puede vaciar una sección.
 *
 *   bun run --cwd worker content
 */
const OUTPUT_PATH = resolve(import.meta.dir, "../../output/content.json");
const USER_AGENT = "jobit-content/0.1 (+https://jobs.wefaber.net)";
const PAUSE_MS = 500;

interface SourceReport {
  id: string;
  count: number;
  error: string | null;
}

async function readPrevious(): Promise<ContentItem[]> {
  try {
    const raw: unknown = await Bun.file(OUTPUT_PATH).json();
    const items = (raw as { items?: unknown }).items;
    return Array.isArray(items) ? items.filter(isContentItem) : [];
  } catch {
    return [];
  }
}

export async function runIngest(
  fetcher: typeof fetch = fetch,
  now: string = new Date().toISOString().slice(0, 10),
): Promise<{ content: FetchedContent; reports: SourceReport[] }> {
  const previous = await readPrevious();
  const fetched: ContentItem[] = [];
  const reports: SourceReport[] = [];

  for (const source of CONTENT_SOURCES) {
    try {
      const items = await collect(source, { fetchImpl: fetcher, now, userAgent: USER_AGENT });
      fetched.push(...items);
      reports.push({ id: source.id, count: items.length, error: null });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      const rescued = previous.filter((item) => item.source === source.id);
      fetched.push(...rescued);
      reports.push({ id: source.id, count: rescued.length, error });
    }
    await Bun.sleep(PAUSE_MS);
  }

  const unique = new Map<string, ContentItem>();
  for (const item of fetched) unique.set(item.id, item);

  return {
    content: { fetched_at: now, items: [...unique.values()] },
    reports,
  };
}

async function main(): Promise<void> {
  const { content, reports } = await runIngest();

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await Bun.write(OUTPUT_PATH, `${JSON.stringify(content, null, 2)}\n`);

  for (const report of reports) {
    const mark = report.error ? `error: ${report.error}` : `${report.count} ítems`;
    console.log(`[jobit] ${report.id}: ${mark}`);
  }
  console.log(`[jobit] ${content.items.length} ítems -> ${OUTPUT_PATH}`);
}

if (import.meta.main) await main();
