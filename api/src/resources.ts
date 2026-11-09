import { CATEGORIES, categoryLabel } from '@jobit/worker/categories'
import {
  RESOURCE_TYPES,
  externalRel,
  orderResources,
  resourceType,
} from '@jobit/worker/content/resources'
import type { ContentItem } from '@jobit/worker/content/types'
import { escapeHtml, layout, publicOrigin } from './pages.ts'

/**
 * Las páginas de recursos por rubro (`/recursos` y `/recursos/<rubro>`).
 *
 * Son enlaces a sitios de terceros, así que la política va en el código y no en
 * la buena voluntad de quien edite el contenido:
 *
 * - todo enlace saliente sale con `noopener`, y con `sponsored` cuando el
 *   recurso lo marca (`externalRel`);
 * - un recurso patrocinado se rotula "Patrocinado" a la vista;
 * - el patrocinio no mueve el orden (`orderResources` ordena por tipo y título).
 */

/** Los rubros que tienen al menos un recurso, en el orden del tablero. */
export function resourceCategories(items: ContentItem[]): string[] {
  const withResources = new Set(
    items
      .filter((item) => item.kind === 'resource')
      .flatMap((item) => item.categories),
  )
  return CATEGORIES.map((category) => category.slug).filter((slug) =>
    withResources.has(slug),
  )
}

export const resourcesOf = (
  items: ContentItem[],
  slug: string,
): ContentItem[] =>
  orderResources(
    items.filter(
      (item) => item.kind === 'resource' && item.categories.includes(slug),
    ),
  )

function resourceHtml(item: ContentItem): string {
  const sponsored = item.sponsored
    ? `<span class="chip">Patrocinado</span> `
    : ''
  const lang = item.tags.includes('es')
    ? 'En español'
    : item.tags.includes('en')
      ? 'En inglés'
      : ''
  const title = item.url
    ? `<a href="${escapeHtml(item.url)}" rel="${externalRel(item.sponsored)}" target="_blank">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title)

  return `<li>${sponsored}${title}<div class="where">${escapeHtml(item.source_label)}${lang ? ` · ${lang}` : ''}</div><p>${escapeHtml(item.body)}</p></li>`
}

/**
 * Los recursos de un rubro, agrupados por tipo. `hasInterview` enlaza a la guía
 * de entrevista del mismo rubro solo cuando existe: nunca un enlace a un 404.
 */
export function resourcesPageHtml(
  slug: string,
  items: ContentItem[],
  hasInterview: boolean,
): string {
  const label = categoryLabel(slug)
  const origin = publicOrigin()
  const ordered = orderResources(items)

  const groups = RESOURCE_TYPES.map((type) => {
    const inGroup = ordered.filter((item) => resourceType(item) === type.id)
    return inGroup.length > 0
      ? `<h2>${escapeHtml(type.label)}</h2><ul class="jobs">${inGroup.map(resourceHtml).join('')}</ul>`
      : ''
  }).join('')

  const hasSponsored = ordered.some((item) => item.sponsored)

  const body = `
<h1>Recursos para aprender y practicar en ${escapeHtml(label)}</h1>
<p>Plataformas de práctica, documentación, cursos, videos y podcasts para ${escapeHtml(label)}, elegidos a mano. Son sitios de terceros: JobIt no es el autor ni garantiza su contenido.</p>
<a class="cta" href="${escapeHtml(origin)}/?category=${encodeURIComponent(slug)}">Ver las ofertas de ${escapeHtml(label)} en JobIt</a>
${hasInterview ? `<a class="cta ghost" href="${escapeHtml(origin)}/entrevista/${encodeURIComponent(slug)}">Preguntas de entrevista de ${escapeHtml(label)}</a>` : ''}
${groups}
<p class="muted">Los recursos van ordenados por tipo y por nombre. ${hasSponsored ? 'Los marcados como Patrocinado tienen un acuerdo comercial con JobIt, y eso no cambia su lugar en la lista.' : 'Hoy ninguno tiene acuerdo comercial con JobIt; si alguno lo tuviera, se marcaría como Patrocinado y su enlace llevaría rel=&quot;sponsored&quot;, sin cambiar su lugar en la lista.'}</p>`

  return layout(
    {
      title: `Recursos para ${label} en Uruguay: práctica, cursos y documentación · JobIt`,
      description: `Plataformas de práctica, documentación, cursos, videos y podcasts para ${label}, elegidos a mano. Los enlaces patrocinados están marcados.`,
      path: `/recursos/${encodeURIComponent(slug)}`,
    },
    body,
  )
}

/** El índice: un enlace por rubro con recursos, con la cantidad. */
export function resourcesIndexHtml(items: ContentItem[]): string {
  const origin = publicOrigin()
  const rows = resourceCategories(items)
    .map((slug) => {
      const count = resourcesOf(items, slug).length
      return `<li><a href="${escapeHtml(origin)}/recursos/${encodeURIComponent(slug)}">${escapeHtml(categoryLabel(slug))}</a><div class="where">${count} ${count === 1 ? 'recurso' : 'recursos'}</div></li>`
    })
    .join('')

  return layout(
    {
      title: 'Recursos para aprender y practicar por rubro · JobIt',
      description:
        'Plataformas de práctica, documentación, cursos, videos y podcasts por rubro, para prepararte antes de postularte. Los enlaces patrocinados están marcados.',
      path: '/recursos',
    },
    `<h1>Recursos para aprender y practicar</h1>
<p>Elegí tu rubro y mirá dónde practicar, qué documentación leer y qué cursos hacer.</p>
<ul class="jobs">${rows}</ul>`,
  )
}
