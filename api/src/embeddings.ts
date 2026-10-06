import { db } from "./db.ts";
import { decodeVector, encodeVector } from "./vectors.ts";

/**
 * Cliente del embedder propio (EmbeddingGemma 2, servido en el VPS) y las
 * operaciones sobre la tabla `offer_embeddings`. El cliente habla el dialecto
 * OpenAI (`POST /v1/embeddings`) y no depende de nada más que `fetch`, así que
 * en los tests se lo puede apuntar a un servidor falso con EMBEDDER_URL.
 *
 * Si el embedder no está, esto tira `EmbedderError`. Las rutas que ya existían
 * no lo usan, así que siguen funcionando exactamente igual: la búsqueda
 * semántica es un agregado que se apaga solo, no algo de lo que dependa el
 * tablero.
 */

export const DEFAULT_EMBEDDER_URL = "http://127.0.0.1:8891/v1/embeddings";
export const DEFAULT_EMBEDDER_MODEL = "embeddinggemma-2";

/** 16 por pedido: medido contra el VPS, un batch de tres tarda ~40 ms y de ahí
 * para arriba manda el tamaño del lote, no la latencia por texto. */
const DEFAULT_BATCH = 16;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

const envString = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export const embedderUrl = (): string => envString("EMBEDDER_URL") ?? DEFAULT_EMBEDDER_URL;
export const embedderModel = (): string => envString("EMBEDDER_MODEL") ?? DEFAULT_EMBEDDER_MODEL;

export const embedderBatch = (): number => {
  const configured = Number(envString("EMBEDDER_BATCH"));
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_BATCH;
};

const embedderTimeout = (): number => {
  const configured = Number(envString("EMBEDDER_TIMEOUT_MS"));
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
};

/** Por qué falló, sin obligar a leer el mensaje: la ruta decide el código HTTP
 * según esto y el backfill decide si seguir con la próxima tanda. */
export type EmbedderErrorKind = "unavailable" | "timeout" | "status" | "malformed" | "empty";

export class EmbedderError extends Error {
  readonly kind: EmbedderErrorKind;
  readonly status: number | null;

  constructor(kind: EmbedderErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "EmbedderError";
    this.kind = kind;
    this.status = status;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Convierte la respuesta OpenAI en vectores en el orden en que se pidieron.
 * El `index` de cada entrada es la única pista del orden, así que se respeta:
 * si el embedder los devolviera desordenados, emparejarlos por posición
 * guardaría el vector de una oferta en otra.
 */
function parseVectors(payload: unknown, expected: number): Float32Array[] {
  const data = isObject(payload) ? payload.data : undefined;
  if (!Array.isArray(data) || data.length !== expected) {
    throw new EmbedderError(
      "malformed",
      "el embedder devolvió una cantidad de vectores inesperada",
    );
  }

  const ordered = new Array<Float32Array | undefined>(expected);
  for (const [position, entry] of data.entries()) {
    const embedding = isObject(entry) ? entry.embedding : undefined;
    const index = isObject(entry) && typeof entry.index === "number" ? entry.index : position;

    if (!Number.isInteger(index) || index < 0 || index >= expected || ordered[index]) {
      throw new EmbedderError("malformed", "el embedder devolvió índices de vector inválidos");
    }
    if (
      !Array.isArray(embedding) ||
      embedding.length === 0 ||
      !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      throw new EmbedderError("malformed", "el embedder devolvió un vector inválido");
    }
    ordered[index] = Float32Array.from(embedding as number[]);
  }

  const vectors = ordered.filter((vector): vector is Float32Array => vector !== undefined);
  if (vectors.length !== expected) {
    throw new EmbedderError("malformed", "el embedder devolvió vectores repetidos");
  }

  const dim = vectors[0]?.length ?? 0;
  if (vectors.some((vector) => vector.length !== dim)) {
    throw new EmbedderError("malformed", "el embedder devolvió dimensiones mezcladas");
  }

  return vectors;
}

async function embedBatch(batch: string[]): Promise<Float32Array[]> {
  const timeout = embedderTimeout();

  let response: Response;
  try {
    response = await fetch(embedderUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: batch, model: embedderModel() }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (cause) {
    const timedOut =
      cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    throw new EmbedderError(
      timedOut ? "timeout" : "unavailable",
      `el embedder no respondió: ${String(cause)}`,
    );
  }

  if (!response.ok) {
    throw new EmbedderError("status", `el embedder respondió ${response.status}`, response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new EmbedderError("malformed", `la respuesta del embedder no es JSON: ${String(cause)}`);
  }

  return parseVectors(payload, batch.length);
}

/**
 * Embebe una lista de textos y devuelve los vectores en el mismo orden. Parte
 * el trabajo en lotes para no mandarle al embedder un pedido enorme, lo que
 * además mantiene la latencia por debajo del timeout de nginx.
 */
export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  const size = embedderBatch();
  const vectors: Float32Array[] = [];
  for (let start = 0; start < texts.length; start += size) {
    vectors.push(...(await embedBatch(texts.slice(start, start + size))));
  }
  return vectors;
}

/** Un vector tal como vive en la base. */
export interface StoredEmbedding {
  offer_id: string;
  model: string;
  dim: number;
  vec: Float32Array;
  updated_at: string;
}

interface EmbeddingRow {
  offer_id: string;
  model: string;
  dim: number;
  vec: Uint8Array;
  updated_at: string;
}

const hydrate = (row: EmbeddingRow): StoredEmbedding => ({
  offer_id: row.offer_id,
  model: row.model,
  dim: row.dim,
  vec: decodeVector(row.vec),
  updated_at: row.updated_at,
});

/** Escribe el vector de una oferta, pisando el anterior si ya estaba. */
export function upsertEmbedding(
  offerId: string,
  vector: Float32Array,
  options: { model?: string; updatedAt?: string } = {},
): void {
  db().run(
    `INSERT INTO offer_embeddings (offer_id, model, dim, vec, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(offer_id) DO UPDATE SET
       model      = excluded.model,
       dim        = excluded.dim,
       vec        = excluded.vec,
       updated_at = excluded.updated_at`,
    [
      offerId,
      options.model ?? embedderModel(),
      vector.length,
      encodeVector(vector),
      options.updatedAt ?? new Date().toISOString(),
    ],
  );
}

export function embeddingOf(offerId: string): StoredEmbedding | null {
  const row = db()
    .query<EmbeddingRow, [string]>("SELECT * FROM offer_embeddings WHERE offer_id = ?")
    .get(offerId);
  return row ? hydrate(row) : null;
}

/**
 * Los vectores de los ids pedidos, del modelo dado. La búsqueda primero filtra
 * y recién después pide los vectores de lo que quedó: leer la tabla entera para
 * descartar casi todo sería el trabajo caro sin motivo. Se parte en tandas
 * porque SQLite tiene un techo de parámetros por consulta.
 */
export function embeddingsFor(
  ids: string[],
  model: string = embedderModel(),
): Map<string, Float32Array> {
  const vectors = new Map<string, Float32Array>();
  const CHUNK = 500;

  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db()
      .query<EmbeddingRow, string[]>(
        `SELECT * FROM offer_embeddings WHERE model = ? AND offer_id IN (${placeholders})`,
      )
      .all(model, ...chunk);
    for (const row of rows) vectors.set(row.offer_id, decodeVector(row.vec));
  }

  return vectors;
}

/** Los ids que ya tienen vector del modelo vigente: lo que el backfill saltea. */
export function embeddedIds(model: string = embedderModel()): Set<string> {
  const rows = db()
    .query<{ offer_id: string }, [string]>("SELECT offer_id FROM offer_embeddings WHERE model = ?")
    .all(model);
  return new Set(rows.map((row) => row.offer_id));
}

export function embeddingCount(model: string = embedderModel()): number {
  const row = db()
    .query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM offer_embeddings WHERE model = ?")
    .get(model);
  return row?.n ?? 0;
}
