import { roleOf } from '@jobit/worker/roles'
import { useEffect, useState } from 'react'
import { fetchContent, roleGuideHref } from '../lib/content.ts'

/**
 * La dirección de la guía de entrevista del puesto de una oferta, o null.
 *
 * El puesto sale del título con el mismo catálogo del tablero. Se pide un solo
 * ítem de ese puesto: alcanza para saber si hay guía y bajo qué rubro vive. Se
 * guarda en memoria por puesto (también el "no hay"), así abrir otra oferta del
 * mismo puesto no vuelve a la red.
 */
const FRESH_MS = 30 * 60_000
const cache = new Map<string, { at: number; href: string | null }>()

const cached = (role: string): string | null | undefined => {
  const hit = cache.get(role)
  return hit && Date.now() - hit.at < FRESH_MS ? hit.href : undefined
}

export function useRoleGuide(title: string): string | null {
  const role = roleOf(title)?.slug ?? ''
  const [href, setHref] = useState<string | null>(() =>
    role ? (cached(role) ?? null) : null,
  )

  useEffect(() => {
    if (!role) {
      setHref(null)
      return
    }

    const hit = cached(role)
    if (hit !== undefined) {
      setHref(hit)
      return
    }

    const controller = new AbortController()
    setHref(null)

    fetchContent({ kinds: ['faq', 'topic'], role, limit: 1 }, controller.signal)
      .then((page) => {
        const found = roleGuideHref(role, page.items)
        cache.set(role, { at: Date.now(), href: found })
        setHref(found)
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        /** Sin guía o con la API caída no se muestra el enlace: no es un error. */
        setHref(null)
      })

    return () => controller.abort()
  }, [role])

  return href
}
