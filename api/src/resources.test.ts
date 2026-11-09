import { describe, expect, test } from 'bun:test'
import { RESOURCE_ITEMS } from '@jobit/worker/content/resources'
import type { ContentItem } from '@jobit/worker/content/types'

process.env.PUBLIC_ORIGIN = 'https://jobs.test'

const {
  resourceCategories,
  resourcesIndexHtml,
  resourcesOf,
  resourcesPageHtml,
} = await import('./resources.ts')

const item = (overrides: Partial<ContentItem>): ContentItem => ({
  ...RESOURCE_ITEMS[0]!,
  ...overrides,
})

const free = item({
  id: 'r:free',
  title: 'Plataforma libre',
  url: 'https://libre.example/',
  sponsored: false,
  tags: ['plataforma', 'es'],
})
const paid = item({
  id: 'r:paid',
  title: 'Plataforma paga',
  url: 'https://paga.example/?a=1&b=2',
  sponsored: true,
  tags: ['plataforma', 'en'],
})

/** Cada `<a ...>` que sale hacia otro sitio, con su atributo rel. */
const externalAnchors = (html: string): { href: string; rel: string }[] =>
  [...html.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)]
    .filter((match) => !match[1]!.startsWith('https://jobs.test'))
    .map((match) => ({
      href: match[1]!,
      rel: /rel="([^"]*)"/.exec(match[0])?.[1] ?? '',
    }))

describe('resourcesPageHtml', () => {
  const html = resourcesPageHtml('tecnologia', [free, paid], true)

  test('un recurso patrocinado sale con rel sponsored y noopener, y rotulado', () => {
    const anchor = externalAnchors(html).find((entry) =>
      entry.href.includes('paga.example'),
    )
    expect(anchor?.rel.split(' ')).toContain('sponsored')
    expect(anchor?.rel.split(' ')).toContain('noopener')
    expect(html).toContain('Patrocinado')
  })

  test('uno que no lo es no lleva sponsored', () => {
    const anchor = externalAnchors(html).find((entry) =>
      entry.href.includes('libre.example'),
    )
    expect(anchor?.rel.split(' ')).not.toContain('sponsored')
    expect(anchor?.rel.split(' ')).toContain('noopener')
  })

  test('escapa el HTML de la URL y del texto', () => {
    expect(html).toContain('paga.example/?a=1&amp;b=2')
    const evil = resourcesPageHtml(
      'tecnologia',
      [item({ title: '<script>x</script>' })],
      false,
    )
    expect(evil).not.toContain('<script>x</script>')
  })

  test('tiene canonical propio y enlaza a la guía de entrevista solo si existe', () => {
    expect(html).toContain(
      'rel="canonical" href="https://jobs.test/recursos/tecnologia"',
    )
    expect(html).toContain('/entrevista/tecnologia')
    expect(resourcesPageHtml('tecnologia', [free], false)).not.toContain(
      '/entrevista/',
    )
  })

  test('el orden no depende del patrocinio', () => {
    expect(html.indexOf('Plataforma libre')).toBeLessThan(
      html.indexOf('Plataforma paga'),
    )
    const swapped = resourcesPageHtml('tecnologia', [paid, free], true)
    expect(swapped.indexOf('Plataforma libre')).toBeLessThan(
      swapped.indexOf('Plataforma paga'),
    )
  })
})

describe('el catálogo real', () => {
  test('todo enlace saliente de cada página de rubro lleva noopener, y sponsored si corresponde', () => {
    const sponsoredHrefs = new Set(
      RESOURCE_ITEMS.filter((entry) => entry.sponsored).map(
        (entry) => entry.url,
      ),
    )
    for (const slug of resourceCategories(RESOURCE_ITEMS)) {
      const html = resourcesPageHtml(
        slug,
        resourcesOf(RESOURCE_ITEMS, slug),
        false,
      )
      const anchors = externalAnchors(html)
      expect(anchors.length).toBeGreaterThan(0)
      for (const anchor of anchors) {
        const rel = anchor.rel.split(' ')
        expect(rel).toContain('noopener')
        const isSponsored = sponsoredHrefs.has(
          anchor.href.replace(/&amp;/g, '&'),
        )
        expect(rel.includes('sponsored')).toBe(isSponsored)
      }
    }
  })

  test('un recurso marcado sponsored en el catálogo sale con sponsored', () => {
    const marked = RESOURCE_ITEMS.map((entry, index) =>
      index === 0 ? { ...entry, sponsored: true } : entry,
    )
    const slug = marked[0]!.categories[0]!
    const html = resourcesPageHtml(slug, resourcesOf(marked, slug), false)
    const anchor = externalAnchors(html).find(
      (entry) => entry.href === marked[0]!.url,
    )
    expect(anchor?.rel.split(' ')).toContain('sponsored')
  })
})

describe('resourceCategories y el índice', () => {
  test('solo lista rubros con recursos, y los enlaza', () => {
    const slugs = resourceCategories(RESOURCE_ITEMS)
    expect(slugs).toContain('tecnologia')
    expect(slugs).not.toContain('otros')

    const html = resourcesIndexHtml(RESOURCE_ITEMS)
    expect(html).toContain('href="https://jobs.test/recursos/tecnologia"')
    expect(html).toContain('rel="canonical" href="https://jobs.test/recursos"')
  })
})
