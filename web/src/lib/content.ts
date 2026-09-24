import type { ContentItem, ContentKind } from "@jobit/worker/content/types";

/**
 * El contenido curado que la API sirve por rubro y puesto. La web lo pide solo
 * cuando hace falta (al abrir una oferta con seguimiento) y no guarda nada: es
 * público y se puede volver a pedir.
 */
export interface ContentPage {
  total: number;
  offset: number;
  limit: number;
  items: ContentItem[];
}

export interface ContentRequest {
  kinds?: ContentKind[];
  category?: string;
  role?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export const DEFAULT_CONTENT_LIMIT = 12;

export function contentQuery(request: ContentRequest): string {
  const params = new URLSearchParams();
  if (request.kinds?.length) params.set("kind", request.kinds.join(","));
  if (request.category) params.set("category", request.category);
  if (request.role) params.set("role", request.role);
  if (request.q) params.set("q", request.q);
  params.set("limit", String(request.limit ?? DEFAULT_CONTENT_LIMIT));
  if (request.offset) params.set("offset", String(request.offset));
  return params.toString();
}

export async function fetchContent(
  request: ContentRequest,
  signal?: AbortSignal,
): Promise<ContentPage> {
  const response = await fetch(`/api/content?${contentQuery(request)}`, { signal });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  return (await response.json()) as ContentPage;
}

/**
 * El `rel` de un enlace saliente. Los enlaces pagos llevan `sponsored` desde el
 * primer día: es lo que Google penaliza si falta, y retrofitearlo sobre un
 * directorio ya monetizado es caro.
 */
export const externalRel = (sponsored: boolean): string =>
  sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer";
