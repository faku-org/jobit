import { CATEGORIES, categoryLabel } from '@jobit/worker/categories'
import {
  roleGuideName,
  roleGuideQuery,
} from '@jobit/worker/content/role-guides'
import type { ContentItem } from '@jobit/worker/content/types'
import { ROLES } from '@jobit/worker/roles'
import {
  escapeHtml,
  faqPageLd,
  jobListHtml,
  layout,
  paragraphs,
  publicOrigin,
  type RoleGuideLink,
} from './pages.ts'
import type { Job } from './types.ts'

/**
 * La guía de entrevista de un puesto concreto (`/entrevista/<rubro>/<puesto>`).
 *
 * Es el nivel de abajo de `/entrevista/<rubro>`: el contenido lleva `roles` (los
 * slugs de `worker/src/roles.ts`) además de `categories`, y una guía existe solo
 * si hay preguntas o temas para ese par. Sin contenido no hay página: el 404 es
 * lo que evita publicar una guía vacía.
 */

export interface RoleGuideRef extends RoleGuideLink {
  category: string
}

const ROLE_LABEL = new Map(ROLES.map((role) => [role.slug, role.label]))

/** Cómo se nombra el puesto: el nombre curado y, si no hay, el del catálogo. */
export const roleName = (role: string): string =>
  roleGuideName(role) ?? ROLE_LABEL.get(role) ?? role

/**
 * Los pares rubro/puesto que tienen guía, sacados del contenido y no de una
 * lista aparte: lo que se sume por la ingesta aparece solo. Se descartan los
 * que no existen en los catálogos, porque serían URLs que siempre dan 404.
 */
export function roleGuides(items: ContentItem[]): RoleGuideRef[] {
  const found = new Map<string, RoleGuideRef>()

  for (const item of items) {
    if (item.kind !== 'faq' && item.kind !== 'topic') continue
    for (const role of item.roles) {
      if (!ROLE_LABEL.has(role)) continue
      for (const category of item.categories) {
        if (!CATEGORIES.some((entry) => entry.slug === category)) continue
        found.set(`${category}/${role}`, {
          category,
          role,
          name: roleName(role),
        })
      }
    }
  }

  const order = (category: string): number =>
    CATEGORIES.findIndex((entry) => entry.slug === category)

  return [...found.values()].sort(
    (a, b) =>
      order(a.category) - order(b.category) || a.name.localeCompare(b.name),
  )
}

export function roleInterviewPageHtml(
  category: string,
  role: string,
  jobs: Job[],
  items: ContentItem[],
): string {
  const name = roleName(role)
  const rubro = categoryLabel(category)
  const origin = publicOrigin()
  const path = `/entrevista/${encodeURIComponent(category)}/${encodeURIComponent(role)}`
  const query = roleGuideQuery(role) ?? name

  const questions = items.filter((item) => item.kind === 'faq')
  const topics = items.filter((item) => item.kind === 'topic')
  const block = (item: ContentItem): string =>
    `<h3>${escapeHtml(item.title)}</h3>${paragraphs(item.body)}`

  const body = `
<p class="muted"><a href="${escapeHtml(origin)}/entrevista/${encodeURIComponent(category)}">Guía de entrevista de ${escapeHtml(rubro)}</a></p>
<h1>Preguntas de entrevista de ${escapeHtml(name)} en Uruguay</h1>
<p>Las preguntas que suelen hacerse en una entrevista de ${escapeHtml(name)}, con una forma de responderlas, y las habilidades que conviene tener a mano.</p>
<a class="cta" href="${escapeHtml(origin)}/?q=${encodeURIComponent(query)}">Ver las ofertas de ${escapeHtml(name)} en JobIt</a>
${questions.length > 0 ? `<h2>Preguntas frecuentes</h2>${questions.map(block).join('')}` : ''}
${topics.length > 0 ? `<h2>Habilidades y temas</h2>${topics.map(block).join('')}` : ''}
${
  jobs.length > 0
    ? `<h2>Ofertas de ${escapeHtml(name)}</h2><ul class="jobs">${jobListHtml(jobs)}</ul><p class="muted">${jobs.length} ofertas${jobs.length > 100 ? ' (mostrando las primeras 100)' : ''}.</p>`
    : ''
}`

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'JobIt', item: `${origin}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: `Entrevista de ${rubro}`,
        item: `${origin}/entrevista/${encodeURIComponent(category)}`,
      },
      { '@type': 'ListItem', position: 3, name, item: `${origin}${path}` },
    ],
  }

  return layout(
    {
      title: `Preguntas de entrevista de ${name} en Uruguay · JobIt`,
      description: `Preguntas de entrevista para ${name} en Uruguay, con respuestas sugeridas, las habilidades que importan y las ofertas del puesto.`,
      path,
      jsonLd: [faqPageLd(items), breadcrumbs].filter(
        (block): block is Record<string, unknown> => block !== null,
      ),
    },
    body,
  )
}
