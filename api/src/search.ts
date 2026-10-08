import {
  EmbedderError,
  embedTexts,
  embedderModel,
  embeddingOf,
  embeddingsFor,
} from "./embeddings.ts";
import { filterJobs } from "./filter.ts";
import { type Ranking, scoreJob } from "./rank.ts";
import type { Job, JobsQuery, JobsResponse, Result } from "./types.ts";
import { cosine } from "./vectors.ts";

/**
 * La búsqueda por significado: embeber lo que escribió la persona y ordenar las
 * ofertas por coseno contra el vector que ya tienen guardado. Es lo que
 * resuelve "diseño de producto sin experiencia" cuando esas palabras no
 * aparecen en ningún aviso.
 *
 * La comparación es fuerza bruta y a propósito. Medido en este VPS con vectores
 * de 768 dimensiones: ~2.000 ofertas se ordenan en ~11 ms y 10.000 en ~31 ms,
 * que al lado de la ida y vuelta al embedder para vectorizar la consulta no
 * justifica un índice aproximado. El día que el tablero crezca un orden de
 * magnitud, este es el número a revisar.
 */

/** Cuánto pesa lo semántico frente al ranking de rank.ts en el modo híbrido.
 * Con 0.6 manda la consulta, pero una oferta que además encaja con lo que la
 * persona pidió (rubro, modalidad, sueldo) se adelanta a una que solo se
 * parece en el texto. Ajustable por si el balance no cierra. */
const DEFAULT_SEMANTIC_WEIGHT = 0.6;

export const semanticWeight = (): number => {
  const configured = Number(process.env.SEMANTIC_WEIGHT);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1
    ? configured
    : DEFAULT_SEMANTIC_WEIGHT;
};

export interface SemanticHit {
  job: Job;
  /** Coseno contra la consulta, o el score mezclado en modo híbrido. */
  score: number;
}

/**
 * Puntúa cada oferta contra el vector de la consulta. Solo entran las que
 * tienen vector: una oferta sin embeber no puede compararse, y descartarla es
 * más honesto que inventarle un parecido en cero.
 */
export function cosineScores(
  jobs: Job[],
  vectors: Map<string, Float32Array>,
  query: Float32Array,
): SemanticHit[] {
  const hits: SemanticHit[] = [];
  for (const job of jobs) {
    const vector = vectors.get(job.id);
    if (vector) hits.push({ job, score: cosine(query, vector) });
  }
  return hits;
}

/** Lleva una lista de números a 0..1 con mínimos y máximos del conjunto. Mezclar
 * dos escalas distintas (el coseno vive en -1..1, rank.ts no tiene techo)
 * exige ponerlas en la misma antes de sumarlas. */
export function normalizeScores(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((value) => (value - min) / (max - min));
}

/**
 * Ordena los aciertos. Sin ranking es el coseno puro. Con ranking (los mismos
 * `rank_*` del feed) mezcla los dos scores normalizados: el texto encuentra la
 * oferta y las preferencias deciden entre las que se parecen. El peso sale de
 * SEMANTIC_WEIGHT.
 */
export function semanticOrder(
  hits: SemanticHit[],
  ranking: Ranking | undefined,
  weight: number = semanticWeight(),
  now: number = Date.now(),
): SemanticHit[] {
  const tieBreak = (a: SemanticHit, b: SemanticHit): number =>
    b.score - a.score ||
    b.job.date_posted.localeCompare(a.job.date_posted) ||
    a.job.id.localeCompare(b.job.id);

  if (!ranking) return [...hits].sort(tieBreak);

  const semantic = normalizeScores(hits.map((hit) => hit.score));
  const rank = normalizeScores(hits.map((hit) => scoreJob(hit.job, ranking, now)));

  return hits
    .map((hit, index) => ({
      job: hit.job,
      score: weight * (semantic[index] ?? 0) + (1 - weight) * (rank[index] ?? 0),
    }))
    .sort(tieBreak);
}

export interface SearchRequest {
  /** Los mismos filtros del feed; `q` es el texto que se embebe. */
  query: JobsQuery;
  /** Preferencias del modo híbrido (los `rank_*` del feed). */
  ranking?: Ranking;
  limit: number;
  offset: number;
}

/**
 * Filtra con las reglas del feed (todo menos el texto, que acá lo resuelve el
 * embedder), ordena por parecido y pagina. Tira `EmbedderError` si el embedder
 * no contesta: la ruta lo traduce a un 503 y lo demás sigue igual.
 */
export async function searchBoard(jobs: Job[], request: SearchRequest): Promise<JobsResponse> {
  const text = (request.query.q ?? "").trim();
  if (!text) return { total: 0, offset: request.offset, limit: request.limit, jobs: [] };

  const queryVector = (await embedTexts([text]))[0];
  if (!queryVector) {
    throw new EmbedderError("empty", "el embedder no devolvió vector para la consulta");
  }

  /** El texto no filtra: ordena. Los filtros estructurados sí recortan antes
   * de traer vectores, que es lo que mantiene barato el modo con filtros. */
  const candidates = filterJobs(jobs, {
    ...request.query,
    q: undefined,
    sort: undefined,
    ranking: undefined,
    limit: jobs.length,
    offset: 0,
  }).jobs;

  const vectors = embeddingsFor(
    candidates.map((job) => job.id),
    embedderModel(),
  );
  const ordered = semanticOrder(cosineScores(candidates, vectors, queryVector), request.ranking);

  return {
    total: ordered.length,
    offset: request.offset,
    limit: request.limit,
    jobs: ordered.slice(request.offset, request.offset + request.limit).map((hit) => hit.job),
  };
}

export type SimilarError = "not-found" | "not-indexed";

/**
 * Las ofertas más parecidas a una, usando el vector que ya tiene guardado. Solo
 * compara contra vectores del mismo modelo: mezclar modelos sería comparar
 * espacios distintos y el coseno no significaría nada.
 */
export function similarBoard(
  jobs: Job[],
  offerId: string,
  limit: number,
  offset: number = 0,
): Result<JobsResponse, SimilarError> {
  const target = jobs.find((job) => job.id === offerId);
  if (!target) return { ok: false, error: "not-found" };

  const stored = embeddingOf(offerId);
  if (!stored) return { ok: false, error: "not-indexed" };

  const others = jobs.filter((job) => job.id !== offerId);
  const vectors = embeddingsFor(
    others.map((job) => job.id),
    stored.model,
  );
  const ordered = semanticOrder(cosineScores(others, vectors, stored.vec), undefined);

  return {
    ok: true,
    value: {
      total: ordered.length,
      offset,
      limit,
      jobs: ordered.slice(offset, offset + limit).map((hit) => hit.job),
    },
  };
}
