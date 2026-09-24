import { db } from "./db.ts";
import * as services from "./services.ts";
import type { Result } from "./types.ts";
import * as users from "./users.ts";

/**
 * La calificación de un servicio: un voto por persona y por servicio, y nadie
 * se califica a sí mismo.
 *
 * `rating_avg` y `rating_count` viven desnormalizados en `services` y se
 * recalculan acá en cada escritura. La lista pública ordena por calificación y
 * no puede estar agregando en cada consulta.
 */
export const REVIEW_STATUSES = ["visible", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/**
 * La antigüedad mínima para poder calificar. Una cuenta recién hecha es lo más
 * barato que hay: pedir unos días no frena a nadie que quiera opinar de verdad
 * y sí encarece hacerse diez cuentas para hundir a alguien una tarde.
 */
export const MIN_ACCOUNT_AGE_DAYS = 3;

const MAX_COMMENT = 1000;
const MAX_REPLY = 1000;

interface ReviewRow {
  id: string;
  service_id: string;
  author_user_id: string | null;
  rating: number;
  comment: string;
  reply: string;
  status: ReviewStatus;
  edited: number;
  created_at: string;
}

export interface Review extends Omit<ReviewRow, "edited"> {
  edited: boolean;
  /** Vacíos cuando la cuenta se borró: la nota es de un tercero y sigue
   * valiendo, pero ya no hay a quién atribuírsela. */
  author_handle: string;
  author_name: string;
}

/** Lo que sale a la calle, sin el id de la cuenta que la escribió. */
export type PublicReview = Omit<Review, "author_user_id">;

export const publicView = (review: Review): PublicReview => {
  const { author_user_id: _author, ...rest } = review;
  return rest;
};

export interface ReviewInput {
  rating: number;
  comment?: string;
}

const day = (now: Date): string => now.toISOString().slice(0, 10);

const trim = (value: string | undefined, max: number): string =>
  (value ?? "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

/**
 * Los días entre dos fechas escritas como día. Las cuentas no guardan la hora
 * —a propósito—, así que la antigüedad se cuenta en días enteros y una cuenta
 * hecha hoy tiene cero.
 */
function daysSince(from: string, now: Date): number {
  /** La cuenta se estampa con la fecha entera; acá se cuenta el día y no el
   * momento, así que se recorta antes de parsear. */
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start)) return 0;

  const today = Date.parse(`${day(now)}T00:00:00Z`);
  return Math.floor((today - start) / 86_400_000);
}

/** La cuenta borrada deja la reseña sin autor, así que el JOIN es LEFT. */
const SELECT = `
  SELECT r.*, COALESCE(u.handle, '') AS author_handle,
         COALESCE(u.display_name, '') AS author_name
    FROM service_reviews r
    LEFT JOIN users u ON u.id = r.author_user_id
`;

type JoinedRow = ReviewRow & { author_handle: string; author_name: string };

const hydrate = (row: JoinedRow): Review => ({ ...row, edited: row.edited === 1 });

export function byId(id: string): Review | null {
  const row = db().query<JoinedRow, [string]>(`${SELECT} WHERE r.id = ?`).get(id);
  return row ? hydrate(row) : null;
}

/** Lo que se ve en la ficha: lo visible, lo último primero. */
export function listFor(serviceId: string): Review[] {
  return db()
    .query<JoinedRow, [string]>(
      `${SELECT} WHERE r.service_id = ? AND r.status = 'visible'
        ORDER BY r.created_at DESC, r.id`,
    )
    .all(serviceId)
    .map(hydrate);
}

/** La propia, esté visible o bajada: quien la escribió tiene que poder verla. */
export function mineFor(serviceId: string, userId: string): Review | null {
  const row = db()
    .query<JoinedRow, [string, string]>(`${SELECT} WHERE r.service_id = ? AND r.author_user_id = ?`)
    .get(serviceId, userId);
  return row ? hydrate(row) : null;
}

export interface RatingSummary {
  average: number;
  count: number;
}

/**
 * Recalcula el promedio sobre lo visible. Lo que bajó la moderación no cuenta:
 * si contara, bajarla no serviría de nada.
 *
 * El promedio se guarda con dos decimales. Se muestra con uno, pero el orden
 * por calificación necesita desempatar algo mejor que eso.
 */
export function recalc(serviceId: string): RatingSummary {
  const row = db()
    .query<{ n: number; avg: number | null }, [string]>(
      `SELECT COUNT(*) AS n, AVG(rating) AS avg
         FROM service_reviews WHERE service_id = ? AND status = 'visible'`,
    )
    .get(serviceId);

  const count = row?.n ?? 0;
  const average = count > 0 ? Math.round((row?.avg ?? 0) * 100) / 100 : 0;

  db().run("UPDATE services SET rating_avg = ?, rating_count = ? WHERE id = ?", [
    average,
    count,
    serviceId,
  ]);

  return { average, count };
}

function cleanRating(value: number): Result<number> {
  const rating = Math.round(Number(value));
  return Number.isFinite(rating) && rating >= MIN_RATING && rating <= MAX_RATING
    ? { ok: true, value: rating }
    : { ok: false, error: `la nota va de ${MIN_RATING} a ${MAX_RATING}` };
}

/**
 * Quién puede calificar qué. Se responde entero acá y no repartido entre la
 * ruta y el modelo: son reglas del dominio, no del transporte.
 */
function allowed(serviceId: string, userId: string, now: Date): Result<services.Service> {
  const service = services.byId(serviceId);
  if (!service || service.status !== "published") {
    return { ok: false, error: "ese servicio no existe" };
  }
  if (service.user_id === userId) {
    return { ok: false, error: "no se puede calificar un servicio propio" };
  }

  const author = users.byId(userId);
  if (!author) return { ok: false, error: "no hay sesión" };

  if (daysSince(author.created_at, now) < MIN_ACCOUNT_AGE_DAYS) {
    return {
      ok: false,
      error: `hay que tener la cuenta hecha hace ${MIN_ACCOUNT_AGE_DAYS} días para calificar`,
    };
  }

  return { ok: true, value: service };
}

export function create(
  serviceId: string,
  userId: string,
  input: ReviewInput,
  now: Date = new Date(),
): Result<Review> {
  const can = allowed(serviceId, userId, now);
  if (!can.ok) return can;

  const rating = cleanRating(input.rating);
  if (!rating.ok) return rating;

  if (mineFor(serviceId, userId)) {
    return { ok: false, error: "ya calificaste este servicio" };
  }

  const id = crypto.randomUUID();
  db().run(
    `INSERT INTO service_reviews (id, service_id, author_user_id, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, serviceId, userId, rating.value, trim(input.comment, MAX_COMMENT), day(now)],
  );

  recalc(serviceId);

  const review = byId(id);
  return review ? { ok: true, value: review } : { ok: false, error: "no se pudo calificar" };
}

/**
 * La única corrección que se permite. Después queda como está: una nota que se
 * puede reescribir para siempre es una nota que se negocia con quien publica.
 */
export function update(
  reviewId: string,
  userId: string,
  input: ReviewInput,
  now: Date = new Date(),
): Result<Review> {
  const current = byId(reviewId);
  if (!current || current.author_user_id !== userId) {
    return { ok: false, error: "esa calificación no existe" };
  }
  if (current.edited) {
    return { ok: false, error: "una calificación se puede corregir una sola vez" };
  }
  if (current.status !== "visible") {
    return { ok: false, error: "esa calificación la bajó la moderación" };
  }

  const rating = cleanRating(input.rating);
  if (!rating.ok) return rating;

  db().run(
    "UPDATE service_reviews SET rating = ?, comment = ?, edited = 1, created_at = ? WHERE id = ?",
    [rating.value, trim(input.comment, MAX_COMMENT), day(now), reviewId],
  );

  recalc(current.service_id);

  const updated = byId(reviewId);
  return updated
    ? { ok: true, value: updated }
    : { ok: false, error: "esa calificación no existe" };
}

/**
 * La respuesta de quien publica. Una sola, y solo sobre lo suyo: esto no es un
 * hilo y no hace falta que lo sea para poder dar la otra versión.
 */
export function reply(reviewId: string, ownerUserId: string, text: string): Result<Review> {
  const current = byId(reviewId);
  if (!current) return { ok: false, error: "esa calificación no existe" };

  const service = services.byId(current.service_id);
  if (!service || service.user_id !== ownerUserId) {
    return { ok: false, error: "esa calificación no existe" };
  }
  if (current.reply) {
    return { ok: false, error: "ya respondiste esta calificación" };
  }

  const answer = trim(text, MAX_REPLY);
  if (!answer) return { ok: false, error: "la respuesta no puede estar vacía" };

  db().run("UPDATE service_reviews SET reply = ? WHERE id = ?", [answer, reviewId]);

  const updated = byId(reviewId);
  return updated
    ? { ok: true, value: updated }
    : { ok: false, error: "esa calificación no existe" };
}

/** Lo que decide la moderación sobre una reseña. Bajarla la saca del promedio. */
export function setStatus(reviewId: string, status: ReviewStatus): boolean {
  const current = byId(reviewId);
  if (!current) return false;

  db().run("UPDATE service_reviews SET status = ? WHERE id = ?", [status, reviewId]);
  recalc(current.service_id);
  return true;
}

/** Borrar la propia. El promedio vuelve a lo que era sin ella. */
export function remove(reviewId: string, userId: string): boolean {
  const current = byId(reviewId);
  if (!current || current.author_user_id !== userId) return false;

  db().run("DELETE FROM service_reviews WHERE id = ?", [reviewId]);
  recalc(current.service_id);
  return true;
}
