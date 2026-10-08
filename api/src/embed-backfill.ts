import { closeDb, db } from "./db.ts";
import {
  EmbedderError,
  embedTexts,
  embedderModel,
  embeddedIds,
  upsertEmbedding,
} from "./embeddings.ts";
import { loadFeed } from "./feed.ts";
import type { Job } from "./types.ts";
import { offerText } from "./vectors.ts";

/**
 * Backfill de los vectores de oferta. Recorre las ofertas del tablero
 * (publicadas propias + scrapeadas activas), embebe las que todavía no tienen
 * vector del modelo vigente y las guarda. Es idempotente: volver a correrlo
 * solo mira las nuevas, y una corrida interrumpida se retoma desde donde
 * quedó, porque cada tanda se guarda en su propia transacción.
 *
 * Escribe en la misma base que la API. No la bloquea: la base está en modo
 * WAL y con busy_timeout, así que una lectura de la API espera a lo sumo lo
 * que dura una transacción corta y nunca a la corrida entera. Aun así, esto es
 * un proceso aparte (`bun run --cwd api embed`): el que embebe mil ofertas no
 * es el mismo que contesta un pedido.
 */

export interface BackfillResult {
  embedded: number;
  skipped: number;
  failed: number;
  /** Dimensiones del modelo, o null si no se embebió nada. */
  dim: number | null;
}

export interface BackfillOptions {
  /** Modelo con el que se decidió qué ya está embebido. Default: el del entorno. */
  model?: string;
  /** Reembebe todo, aunque ya tenga vector del modelo actual. */
  force?: boolean;
  /** En los tests entra un embedder falso; en producción, el cliente real. */
  embed?: (texts: string[]) => Promise<Float32Array[]>;
  log?: (message: string) => void;
}

/**
 * Cuántas ofertas se guardan por transacción. Alto para que el guardado no se
 * note al lado de la latencia del embedder, corto para que una corrida cortada
 * conserve casi todo lo hecho.
 */
const FRAME = 64;

export async function backfill(
  jobs: Job[],
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const model = options.model ?? embedderModel();
  const embed = options.embed ?? embedTexts;
  const log = options.log ?? (() => {});

  const known = options.force ? new Set<string>() : embeddedIds(model);
  const pending = jobs.filter((job) => !known.has(job.id));

  const result: BackfillResult = {
    embedded: 0,
    skipped: jobs.length - pending.length,
    failed: 0,
    dim: null,
  };

  if (pending.length === 0) {
    log(`nada para embeber: las ${jobs.length} ofertas ya tienen vector de ${model}`);
    return result;
  }

  log(`${pending.length} ofertas para embeber con ${model} (${result.skipped} ya estaban)`);

  for (let start = 0; start < pending.length; start += FRAME) {
    const frame = pending.slice(start, start + FRAME);

    let vectors: Float32Array[];
    try {
      vectors = await embed(frame.map(offerText));
    } catch (cause) {
      /** Una tanda que falla no tira abajo la corrida: el embedder puede estar
       * reiniciándose y el resto de las ofertas no tiene por qué pagarlo. */
      if (!(cause instanceof EmbedderError)) throw cause;
      result.failed += frame.length;
      log(`la tanda ${start + 1}-${start + frame.length} falló: ${cause.message}`);
      continue;
    }

    if (vectors.length !== frame.length) {
      throw new Error("el embedder devolvió un lote incompleto");
    }

    result.dim = vectors[0]?.length ?? result.dim;
    db().transaction(() => {
      frame.forEach((job, index) => {
        const vector = vectors[index];
        if (vector) upsertEmbedding(job.id, vector, { model });
      });
    })();

    result.embedded += frame.length;
    log(`embebidas ${result.embedded}/${pending.length}`);
  }

  return result;
}

if (import.meta.main) {
  const file = await loadFeed();
  if (!file.ok) {
    console.error(`[jobit] no se pudo leer el tablero: ${file.error}`);
    process.exit(1);
  }

  const model = embedderModel();
  console.log(`[jobit] embebiendo ${file.value.jobs.length} ofertas con ${model}`);

  const result = await backfill(file.value.jobs, {
    force: process.argv.includes("--force"),
    log: (message) => console.log(`[jobit] ${message}`),
  });

  console.log(
    `[jobit] listo: ${result.embedded} nuevas, ${result.skipped} ya estaban, ` +
      `${result.failed} fallaron${result.dim ? `, dim ${result.dim}` : ""}`,
  );

  closeDb();
  process.exitCode = result.failed > 0 ? 1 : 0;
}
