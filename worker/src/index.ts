import { resolve } from "node:path";
import { DetailCache } from "./cache.ts";
import { dedupe } from "./dedupe.ts";
import { proxyDescription } from "./http.ts";
import { keepIfEmpty } from "./keep.ts";
import { toJob } from "./normalize.ts";
import { buscojobs } from "./sources/buscojobs.ts";
import { uruguayconcursa } from "./sources/uruguayconcursa.ts";
import type { Job, JobStub, JobsFile, Source } from "./types.ts";

const OUTPUT_PATH = resolve(import.meta.dir, "../output/jobs.json");
const SOURCES: Source[] = [buscojobs, uruguayconcursa];

const DETAIL_CONCURRENCY = 3;

interface Options {
  /** Skip detail requests entirely and rely on whatever is cached. */
  listOnly: boolean;
  /** Cap on detail requests per run, so a first run can be split in chunks. */
  maxDetails: number;
}

function parseArgs(argv: string[]): Options {
  const maxArg = argv.find((arg) => arg.startsWith("--max-details="));
  return {
    listOnly: argv.includes("--list-only"),
    maxDetails: maxArg ? Number(maxArg.split("=")[1]) : Infinity,
  };
}

const log = (message: string): void => console.log(message);

async function enrich(
  source: Source,
  stubs: JobStub[],
  cache: DetailCache,
  options: Options,
): Promise<Job[]> {
  const pending = stubs.filter((stub) => !cache.get(source.id, stub.source_id));
  const budget = Math.min(pending.length, options.listOnly ? 0 : options.maxDetails);

  if (budget > 0) {
    log(`  ${pending.length} ofertas nuevas, se piden ${budget} detalles`);

    const queue = pending.slice(0, budget);
    let index = 0;
    let done = 0;

    const workers = Array.from({ length: DETAIL_CONCURRENCY }, async () => {
      while (index < queue.length) {
        const stub = queue[index++];
        if (!stub) break;
        const raw = await source.fetchDetail(stub);
        if (raw) cache.set(source.id, stub.source_id, raw);
        done++;
        if (done % 50 === 0) {
          log(`    ${done}/${queue.length} detalles`);
          await cache.save();
        }
      }
    });

    await Promise.all(workers);
    await cache.save();
  } else if (pending.length > 0) {
    log(`  ${pending.length} ofertas sin detalle (se usan los datos del listado)`);
  }

  return stubs.map((stub) => {
    const raw = cache.get(source.id, stub.source_id);
    return toJob(stub, raw === undefined ? null : source.parseDetail(raw));
  });
}

async function readPrevious(): Promise<Job[] | undefined> {
  try {
    const file = (await Bun.file(OUTPUT_PATH).json()) as JobsFile;
    return Array.isArray(file.jobs) ? file.jobs : undefined;
  } catch {
    return undefined;
  }
}

/** El worker solo avisa por acá cuando BuscoJobs vino fresco: es el canario de
 * que la salida (el egress de la PC o el proxy) sigue viva. Si deja de llegar,
 * un monitor externo avisa. Uruguay Concursa no lo dispara a propósito, porque
 * esa fuente no bloquea y no dice nada de la otra. */
const HEARTBEAT_URL = (process.env.JOBIT_HEARTBEAT_URL ?? "").trim();

async function heartbeat(total: number): Promise<void> {
  if (!HEARTBEAT_URL) return;

  const separator = HEARTBEAT_URL.includes("?") ? "&" : "?";
  try {
    await fetch(`${HEARTBEAT_URL}${separator}total=${total}`);
    log("heartbeat enviado (BuscoJobs fresco)");
  } catch (cause) {
    console.warn(`no se pudo mandar el heartbeat: ${String(cause)}`);
  }
}

async function run(): Promise<void> {
  const options = parseArgs(Bun.argv.slice(2));
  const startedAt = Date.now();
  const cache = await DetailCache.load();
  const previous = await readPrevious();
  log(`cache: ${cache.size} detalles`);
  log(`salida: ${proxyDescription()}`);

  const jobs: Job[] = [];
  const liveKeys = new Set<string>();
  /** Las fuentes que trajeron algo en esta corrida, en vez de conservarse. */
  const fresh = new Set<string>();

  for (const source of SOURCES) {
    log(`\n[${source.id}] recolectando listados`);
    let stubs: JobStub[] = [];
    try {
      stubs = await source.collect(log);
    } catch (cause) {
      log(`[${source.id}] falló la recolección: ${String(cause)}`);
    }
    log(`[${source.id}] ${stubs.length} ofertas listadas`);

    const kept = keepIfEmpty(source.id, stubs.length, previous);
    if (kept) {
      log(`[${source.id}] se conservan ${kept.length} de la corrida anterior`);
      for (const job of kept) liveKeys.add(`${job.source}:${job.source_id}`);
      jobs.push(...kept);
      continue;
    }

    fresh.add(source.id);
    for (const stub of stubs) liveKeys.add(`${source.id}:${stub.source_id}`);
    jobs.push(...(await enrich(source, stubs, cache, options)));
  }

  const removed = cache.prune(liveKeys);
  if (removed > 0) log(`\ncache: ${removed} entradas vencidas eliminadas`);
  await cache.save();

  const merged = dedupe(jobs).sort((a, b) => b.date_posted.localeCompare(a.date_posted));

  const payload: JobsFile = {
    scraped_at: new Date().toISOString(),
    sources: SOURCES.map((source) => source.id),
    count: merged.length,
    jobs: merged,
  };

  await Bun.write(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);

  if (fresh.has("buscojobs")) await heartbeat(merged.length);
  else log("\nBuscoJobs no vino fresco: no se manda heartbeat");

  const withDescription = merged.filter((job) => job.description.length > 0).length;
  const firstJob = merged.filter((job) => job.no_experience).length;
  const seconds = Math.round((Date.now() - startedAt) / 1000);

  log(
    `\n${merged.length} ofertas escritas en ${OUTPUT_PATH}` +
      `\n  ${withDescription} con descripción, ${firstJob} sin experiencia requerida` +
      `\n  ${jobs.length - merged.length} duplicadas fusionadas, ${seconds}s`,
  );
}

await run();
