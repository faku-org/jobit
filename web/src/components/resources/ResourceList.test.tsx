import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RESOURCE_ITEMS } from '@jobit/worker/content/resources'
import type { ContentItem } from '@jobit/worker/content/types'
import { ResourceList } from './ResourceList.tsx'

const base = RESOURCE_ITEMS[0]!
const make = (title: string, url: string, sponsored: boolean): ContentItem => ({
  ...base,
  id: title,
  title,
  url,
  sponsored,
  tags: ['plataforma', 'es'],
})

const anchors = (html: string): { href: string; rel: string }[] =>
  [...html.matchAll(/<a [^>]*>/g)].map((match) => ({
    href: /href="([^"]*)"/.exec(match[0])?.[1] ?? '',
    rel: /rel="([^"]*)"/.exec(match[0])?.[1] ?? '',
  }))

describe('ResourceList', () => {
  const html = renderToStaticMarkup(
    <ResourceList
      items={[
        make('Pago', 'https://paga.example/', true),
        make('Libre', 'https://libre.example/', false),
      ]}
    />,
  )

  test('el enlace patrocinado lleva sponsored y noopener, y se rotula', () => {
    const paid = anchors(html).find(
      (anchor) => anchor.href === 'https://paga.example/',
    )
    expect(paid?.rel.split(' ')).toEqual(
      expect.arrayContaining(['sponsored', 'noopener']),
    )
    expect(html).toContain('Patrocinado')
  })

  test('el que no lo es no lleva sponsored', () => {
    const free = anchors(html).find(
      (anchor) => anchor.href === 'https://libre.example/',
    )
    expect(free?.rel.split(' ')).toContain('noopener')
    expect(free?.rel.split(' ')).not.toContain('sponsored')
  })

  test('el patrocinio no mueve el orden', () => {
    expect(html.indexOf('Libre')).toBeLessThan(html.indexOf('Pago'))
  })

  test('todo el catálogo real sale con noopener en cada enlace', () => {
    const all = renderToStaticMarkup(<ResourceList items={RESOURCE_ITEMS} />)
    const found = anchors(all)
    expect(found.length).toBe(RESOURCE_ITEMS.length)
    for (const anchor of found)
      expect(anchor.rel.split(' ')).toContain('noopener')
  })
})
