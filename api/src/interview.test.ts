import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROLE_GUIDES,
  ROLE_GUIDE_ITEMS,
} from '@jobit/worker/content/role-guides'
import type { ContentItem } from '@jobit/worker/content/types'

process.env.DB_FILE = ':memory:'
process.env.PUBLIC_ORIGIN = 'https://jobs.test'

const FIXTURES = join(import.meta.dir, '../../data/test-interview')
mkdirSync(FIXTURES, { recursive: true })

const JOBS_FILE = join(FIXTURES, 'jobs.json')
process.env.JOBS_FILE = JOBS_FILE
process.env.CONTENT_FILE = join(FIXTURES, 'no-hay-contenido-traido.json')

const offer = (id: string, title: string, category: string) => ({
  id,
  source: 'buscojobs',
  source_id: id,
  title,
  company: 'Super',
  department: 'Montevideo',
  city: 'Montevideo',
  category,
  category_label: category,
  category_raw: category,
  date_posted: '2026-09-01T00:00:00.000Z',
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: 'Atender la caja.',
  requirements: null,
  apply_url: 'https://ejemplo.com/aviso',
  duplicates: [],
})

writeFileSync(
  JOBS_FILE,
  JSON.stringify({
    scraped_at: '2026-09-01T00:00:00.000Z',
    sources: ['buscojobs'],
    count: 2,
    jobs: [
      offer('c1', 'Cajero para supermercado', 'ventas'),
      offer('e1', 'Enfermero/a para sanatorio', 'salud'),
    ],
  }),
  'utf8',
)

const { closeDb } = await import('./db.ts')
const { resetLimits } = await import('./limit.ts')
const { clearFeedCache } = await import('./feed.ts')
const { clearContentCache, queryContent } = await import('./content.ts')
const { app } = await import('./index.ts')
const { roleGuides, roleInterviewPageHtml, roleName } =
  await import('./interview.ts')

beforeEach(() => {
  closeDb()
  clearFeedCache()
  clearContentCache()
  resetLimits()
})

const call = (path: string): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`))

const item = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: 'x',
  kind: 'faq',
  title: '¿Cómo cerrás la caja?',
  body: 'Contando dos veces.',
  url: null,
  source: 'jobit',
  source_label: 'JobIt',
  license: null,
  sponsored: false,
  categories: ['ventas'],
  roles: ['cajero'],
  level: null,
  tags: [],
  fetched_at: '2026-11-05',
  ...overrides,
})

describe('roleGuides', () => {
  test('saca los pares rubro/puesto del contenido', () => {
    const guides = roleGuides([
      item(),
      item({ id: 'y', kind: 'topic', title: 'Precisión' }),
      item({ id: 'z', categories: ['salud'], roles: ['enfermeria'] }),
    ])
    expect(guides.map((guide) => `${guide.category}/${guide.role}`)).toEqual([
      'ventas/cajero',
      'salud/enfermeria',
    ])
    expect(guides[0]?.name).toBe('Cajero/a')
  })

  test('descarta lo que no existe en los catálogos o no es una guía', () => {
    expect(roleGuides([item({ roles: ['inventado'] })])).toEqual([])
    expect(roleGuides([item({ categories: ['inventado'] })])).toEqual([])
    expect(roleGuides([item({ kind: 'exercise' })])).toEqual([])
    expect(roleGuides([item({ roles: [] })])).toEqual([])
  })

  test('un puesto sin nombre curado usa el del catálogo', () => {
    expect(roleName('cajero')).toBe('Cajero/a')
    expect(roleName('pintor')).toBe('Pintor / a')
  })
})

describe('roleInterviewPageHtml', () => {
  const items = [
    item(),
    item({ id: 't', kind: 'topic', title: 'Precisión', body: 'Importa.' }),
  ]

  test('lleva FAQPage, breadcrumbs, canonical y enlaces', () => {
    const html = roleInterviewPageHtml('ventas', 'cajero', [], items)
    expect(html).toContain('Preguntas de entrevista de Cajero/a en Uruguay')
    expect(html).toContain(
      'rel="canonical" href="https://jobs.test/entrevista/ventas/cajero"',
    )
    expect(html).toContain('"@type":"FAQPage"')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toContain('href="https://jobs.test/entrevista/ventas"')
    expect(html).toContain('https://jobs.test/?q=cajero')
    expect(html).toContain('¿Cómo cerrás la caja?')
    expect(html).toContain('Precisión')
  })

  test('sin ofertas no dibuja la sección de avisos', () => {
    expect(roleInterviewPageHtml('ventas', 'cajero', [], items)).not.toContain(
      'Ofertas de Cajero',
    )
  })

  test('solo temas: no marca un FAQPage vacío', () => {
    const html = roleInterviewPageHtml(
      'ventas',
      'cajero',
      [],
      [items[1] as ContentItem],
    )
    expect(html).not.toContain('FAQPage')
    expect(html).toContain('"@type":"BreadcrumbList"')
  })
})

describe('las guías curadas', () => {
  test('cada puesto tiene al menos cuatro preguntas y un tema', () => {
    for (const guide of ROLE_GUIDES) {
      const own = ROLE_GUIDE_ITEMS.filter((entry) =>
        entry.roles.includes(guide.role),
      )
      expect(
        own.filter((entry) => entry.kind === 'faq').length,
      ).toBeGreaterThanOrEqual(4)
      expect(
        own.filter((entry) => entry.kind === 'topic').length,
      ).toBeGreaterThanOrEqual(1)
    }
  })

  test('todas salen como guía: puesto y rubro válidos', () => {
    const guides = roleGuides(ROLE_GUIDE_ITEMS)
    expect(guides.length).toBe(ROLE_GUIDES.length)
  })
})

describe('GET /entrevista/:rubro/:puesto', () => {
  test('una guía con contenido sale en HTML, con FAQPage y las ofertas del puesto', async () => {
    const response = await call('/entrevista/ventas/cajero')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('Preguntas de entrevista de Cajero/a en Uruguay')
    expect(html).toContain('"@type":"FAQPage"')
    expect(html).toContain(
      'rel="canonical" href="https://jobs.test/entrevista/ventas/cajero"',
    )
    expect(html).toContain('Cajero para supermercado')
  })

  test('un puesto con guía pero bajo otro rubro da 404', async () => {
    expect((await call('/entrevista/salud/cajero')).status).toBe(404)
  })

  test('un puesto real sin contenido y uno inventado dan 404', async () => {
    expect((await call('/entrevista/oficios/pintor')).status).toBe(404)
    expect((await call('/entrevista/ventas/no-existe')).status).toBe(404)
    expect((await call('/entrevista/no-existe/cajero')).status).toBe(404)
  })

  test('la guía del rubro enlaza a sus puestos y no mezcla sus preguntas', async () => {
    const html = await (await call('/entrevista/ventas')).text()
    expect(html).toContain('href="https://jobs.test/entrevista/ventas/cajero"')
    expect(html).toContain(
      'href="https://jobs.test/entrevista/ventas/vendedor"',
    )
    expect(html).not.toContain(
      '¿Qué hacés si al cerrar la caja te falta o te sobra dinero?',
    )
    expect(html).toContain('¿Cómo manejás a un cliente enojado?')
  })

  test('el sitemap lista cada guía de puesto', async () => {
    const xml = await (await call('/sitemap.xml')).text()
    expect(xml).toContain(
      '<loc>https://jobs.test/entrevista/ventas/cajero</loc>',
    )
    expect(xml).toContain(
      '<loc>https://jobs.test/entrevista/salud/enfermeria</loc>',
    )
    expect(xml).toContain('<loc>https://jobs.test/entrevista/ventas</loc>')
  })
})

describe('/api/content y las guías de puesto', () => {
  test('por puesto devuelve su guía; por rubro con scope=rubro, solo lo general', async () => {
    const byRole = (await (
      await call('/api/content?role=cajero&kind=faq,topic')
    ).json()) as {
      items: ContentItem[]
    }
    expect(byRole.items.length).toBeGreaterThan(0)
    expect(byRole.items.every((entry) => entry.roles.includes('cajero'))).toBe(
      true,
    )

    const scoped = (await (
      await call(
        '/api/content?category=ventas&kind=faq,topic&scope=rubro&limit=60',
      )
    ).json()) as { items: ContentItem[] }
    expect(scoped.items.length).toBeGreaterThan(0)
    expect(scoped.items.every((entry) => entry.roles.length === 0)).toBe(true)

    const mixed = (await (
      await call('/api/content?category=ventas&kind=faq,topic&limit=60')
    ).json()) as {
      items: ContentItem[]
    }
    expect(mixed.items.some((entry) => entry.roles.length > 0)).toBe(true)
  })

  test('scope inválido se rechaza', async () => {
    expect((await call('/api/content?scope=otro')).status).toBe(422)
  })
})

test('queryContent con rubroOnly excluye lo de un puesto', () => {
  const found = queryContent([item(), item({ id: 'g', roles: [] })], {
    category: 'ventas',
    rubroOnly: true,
    limit: 10,
    offset: 0,
  })
  expect(found.items.map((entry) => entry.id)).toEqual(['g'])
})
