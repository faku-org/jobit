import { describe, expect, test } from 'bun:test'
import { CATEGORIES } from '../categories.ts'
import {
  RESOURCE_ITEMS,
  RESOURCE_TYPES,
  externalRel,
  orderResources,
  resourceType,
} from './resources.ts'
import { SEED_ITEMS } from './seed.ts'
import type { ContentItem } from './types.ts'

const slugs = new Set(CATEGORIES.map((category) => category.slug))

describe('catálogo de recursos', () => {
  test('todo recurso es un enlace https con rubro válido y subtipo conocido', () => {
    for (const item of RESOURCE_ITEMS) {
      expect(item.kind).toBe('resource')
      expect(item.url?.startsWith('https://')).toBe(true)
      expect(item.categories.length).toBeGreaterThan(0)
      for (const category of item.categories)
        expect(slugs.has(category)).toBe(true)
      expect(resourceType(item)).not.toBeNull()
      expect(item.body.length).toBeGreaterThan(20)
    }
  })

  test('el patrocinio es un campo explícito y booleano en cada recurso', () => {
    for (const item of RESOURCE_ITEMS)
      expect(typeof item.sponsored).toBe('boolean')
  })

  test('los ids no se repiten y el seed los incluye', () => {
    const ids = RESOURCE_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    const seeded = new Set(SEED_ITEMS.map((item) => item.id))
    for (const id of ids) expect(seeded.has(id)).toBe(true)
  })

  test('cada tipo de recurso está representado', () => {
    for (const type of RESOURCE_TYPES) {
      expect(
        RESOURCE_ITEMS.some((item) => resourceType(item) === type.id),
      ).toBe(true)
    }
  })
})

describe('externalRel', () => {
  test('un enlace patrocinado lleva sponsored y noopener', () => {
    const rel = externalRel(true).split(' ')
    expect(rel).toContain('sponsored')
    expect(rel).toContain('noopener')
  })

  test('uno que no lo es lleva noopener pero no sponsored', () => {
    const rel = externalRel(false).split(' ')
    expect(rel).toContain('noopener')
    expect(rel).not.toContain('sponsored')
  })
})

describe('orderResources', () => {
  const make = (
    title: string,
    type: string,
    sponsored: boolean,
  ): ContentItem => ({
    ...RESOURCE_ITEMS[0]!,
    id: title,
    title,
    sponsored,
    tags: [type, 'es'],
  })

  test('ordena por tipo y título, sin que el patrocinio cambie el lugar', () => {
    const items = [
      make('Zeta', 'plataforma', true),
      make('Alfa', 'plataforma', false),
      make('Beta', 'curso', true),
      make('Gama', 'documentacion', false),
    ]
    expect(orderResources(items).map((item) => item.title)).toEqual([
      'Alfa',
      'Zeta',
      'Gama',
      'Beta',
    ])
  })
})
