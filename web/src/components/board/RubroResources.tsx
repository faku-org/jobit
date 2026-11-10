import { ChevronDown, Compass } from 'lucide-react'
import { RESOURCE_KINDS, usePrep } from '../../hooks/usePrep.ts'
import { ResourceList } from '../resources/ResourceList.tsx'

interface RubroResourcesProps {
  category: string
  label: string
}

/** Los recursos de un rubro caben todos en una página; 60 es el tope de la API. */
const RESOURCE_LIMIT = 60

/**
 * Al filtrar por un rubro, el tablero ofrece los recursos para aprender y
 * practicar en él: plataformas, documentación, cursos, videos y podcasts. Es el
 * mismo contenido que sirve `/recursos/<rubro>` para un buscador. Un rubro sin
 * recursos no dibuja nada.
 */
export function RubroResources({ category, label }: RubroResourcesProps) {
  const resources = usePrep(
    category,
    category !== '',
    RESOURCE_KINDS,
    RESOURCE_LIMIT,
  )
  if (resources.items.length === 0) return null

  return (
    <details className="group rounded-2xl border border-sky/50 bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Compass aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="text-sm font-medium text-ink">
          Recursos para practicar en {label}
        </span>
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-sky/40 px-4 py-3">
        <ResourceList items={resources.items} />
        <a
          className="mt-4 inline-block text-xs font-medium text-brand transition-colors hover:text-ink"
          href={`/recursos/${encodeURIComponent(category)}`}
        >
          Ver la página de recursos de {label}
        </a>
      </div>
    </details>
  )
}
