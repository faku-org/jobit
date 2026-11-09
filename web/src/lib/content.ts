import type { ContentItem, ContentKind } from '@jobit/worker/content/types'

/**
 * El contenido curado que la API sirve por rubro y puesto. La web lo pide solo
 * cuando hace falta (al abrir una oferta con seguimiento) y no guarda nada: es
 * público y se puede volver a pedir.
 */
export interface ContentPage {
  total: number
  offset: number
  limit: number
  items: ContentItem[]
}

export interface ContentRequest {
  kinds?: ContentKind[]
  category?: string
  role?: string
  /** "rubro": solo lo del rubro entero, sin las guías de un puesto concreto. */
  scope?: 'rubro'
  q?: string
  limit?: number
  offset?: number
}

export const DEFAULT_CONTENT_LIMIT = 12

export function contentQuery(request: ContentRequest): string {
  const params = new URLSearchParams()
  if (request.kinds?.length) params.set('kind', request.kinds.join(','))
  if (request.category) params.set('category', request.category)
  if (request.role) params.set('role', request.role)
  if (request.scope) params.set('scope', request.scope)
  if (request.q) params.set('q', request.q)
  params.set('limit', String(request.limit ?? DEFAULT_CONTENT_LIMIT))
  if (request.offset) params.set('offset', String(request.offset))
  return params.toString()
}

export async function fetchContent(
  request: ContentRequest,
  signal?: AbortSignal,
): Promise<ContentPage> {
  const response = await fetch(`/api/content?${contentQuery(request)}`, {
    signal,
  })
  if (!response.ok) throw new Error(`La API respondió ${response.status}`)
  return (await response.json()) as ContentPage
}

/**
 * La dirección de la guía de entrevista de un puesto, o null si no tiene. Sale
 * del propio contenido: el primer ítem dice bajo qué rubro vive la guía, así
 * que la web no necesita saber qué puestos tienen contenido.
 */
export function roleGuideHref(
  role: string,
  items: ContentItem[],
): string | null {
  const item = items.find(
    (entry) => entry.roles.includes(role) && entry.categories.length > 0,
  )
  const category = item?.categories[0]
  return category
    ? `/entrevista/${encodeURIComponent(category)}/${encodeURIComponent(role)}`
    : null
}

/**
 * El `rel` de un enlace saliente. Los enlaces pagos llevan `sponsored` desde el
 * primer día. Una sola definición, compartida con la página `/recursos/<rubro>`
 * de la API, para que web y SEO nunca difieran.
 */
export { externalRel } from '@jobit/worker/content/resources'
