import type { ReportReason } from "./services.ts";

/**
 * La calificación como la ve la ficha. Leerla no pide nada; escribirla pide la
 * cookie de la cuenta, que ya está puesta si alguien entró desde la sección.
 *
 * Sin el id de quien la escribió: el handle y el nombre alcanzan para saber de
 * quién es, que es lo mismo que pasa con quien publica.
 */
export interface Review {
  id: string;
  service_id: string;
  rating: number;
  comment: string;
  /** La respuesta de quien publica. Vacía mientras no haya contestado. */
  reply: string;
  status: "visible" | "hidden";
  edited: boolean;
  created_at: string;
  /** Vacíos cuando la cuenta se borró: la nota queda, el autor no. */
  author_handle: string;
  author_name: string;
}

export interface ReviewsPage {
  reviews: Review[];
  summary: { average: number; count: number };
  /** La propia, aunque la moderación la haya bajado. */
  mine: Review | null;
  /** `null` cuando no hay sesión: no se sabe todavía. */
  can_review: boolean | null;
  is_owner: boolean;
}

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Lo que quiere decir cada estrella, para que poner una no sea a ciegas. */
export const RATING_LABEL: Record<number, string> = {
  1: "Muy malo",
  2: "Malo",
  3: "Regular",
  4: "Bueno",
  5: "Muy bueno",
};

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    ...(init.method ? { headers: { "Content-Type": "application/json", ...init.headers } } : {}),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      summary?: string;
    } | null;
    throw new Error(body?.error ?? body?.summary ?? `La API respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

export const fetchReviews = (slug: string, signal?: AbortSignal): Promise<ReviewsPage> =>
  send<ReviewsPage>(`/api/services/${encodeURIComponent(slug)}/reviews`, { signal });

export interface ReviewInput {
  rating: number;
  comment?: string;
}

export const createReview = (slug: string, input: ReviewInput): Promise<Review> =>
  send<Review>(`/api/services/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateReview = (id: string, input: ReviewInput): Promise<Review> =>
  send<Review>(`/api/reviews/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteReview = (id: string): Promise<{ status: string }> =>
  send<{ status: string }>(`/api/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });

export const replyReview = (id: string, text: string): Promise<Review> =>
  send<Review>(`/api/reviews/${encodeURIComponent(id)}/reply`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

/** Denunciar una calificación tampoco pide cuenta ni manda quién fue. */
export const reportReview = (id: string, reason: ReportReason): Promise<{ status: string }> =>
  send<{ status: string }>(`/api/reviews/${encodeURIComponent(id)}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

/** "3 opiniones", "1 opinión", y sin votos lo dice con palabras. */
export const pluralReviews = (count: number): string =>
  count === 0 ? "Todavía sin calificaciones" : count === 1 ? "1 opinión" : `${count} opiniones`;
