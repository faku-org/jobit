import { Bookmark, ChartColumn, LayoutList, Wrench } from 'lucide-react'
import { m } from 'motion/react'
import { islandTransition } from '../../lib/motion.ts'
import type { View } from '../../lib/types.ts'

/** Las pestañas son las cuatro listas de trabajo. Perfil, novedades, ayuda y el
 * test son páginas propias: no viven acá. */
export type TabView = 'all' | 'services' | 'saved' | 'market'

interface ViewTabsProps {
  view: View
  /** Guardadas y las que están en seguimiento: la pestaña las junta. */
  savedCount: number
  onChange: (view: TabView) => void
  /** Apuntar una pestaña ya es intención de abrirla: se avisa para que lo que
   * hay detrás empiece a venir antes del clic. */
  onPrefetch: (view: TabView) => void
}

const TABS: { value: TabView; label: string; icon: typeof LayoutList }[] = [
  { value: 'all', label: 'Ofertas', icon: LayoutList },
  { value: 'services', label: 'Servicios', icon: Wrench },
  { value: 'saved', label: 'Guardadas', icon: Bookmark },
  { value: 'market', label: 'Mercado', icon: ChartColumn },
]

/** Cambia el área principal entre el listado, los servicios, lo guardado (con
 * su seguimiento) y los números del país. */
export function ViewTabs({
  view,
  savedCount,
  onChange,
  onPrefetch,
}: ViewTabsProps) {
  return (
    <div
      className="grid grid-cols-4 gap-1 rounded-2xl border border-sky/50 bg-surface p-1 shadow-[var(--shadow-hairline)] md:flex"
      role="tablist"
    >
      {TABS.map((tab) => {
        const active = view === tab.value
        const count = tab.value === 'saved' ? savedCount : 0

        return (
          <button
            key={tab.value}
            aria-selected={active}
            className={`relative flex min-h-10 items-center justify-center gap-1 rounded-xl px-0.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors sm:text-xs md:min-h-0 md:grow md:basis-auto md:gap-1.5 md:px-2.5 md:py-2 md:text-[13px] ${
              active ? 'text-onpanel' : 'text-muted hover:text-ink'
            }`}
            role="tab"
            type="button"
            onClick={() => onChange(tab.value)}
            onFocus={() => onPrefetch(tab.value)}
            onMouseEnter={() => onPrefetch(tab.value)}
            onPointerDown={() => onPrefetch(tab.value)}
          >
            {active ? (
              <m.span
                className="absolute inset-0 rounded-xl bg-panel"
                layoutId="view-tab"
                transition={islandTransition}
              />
            ) : null}
            {/* En el teléfono la celda da para el nombre o para el ícono, y el
                nombre es el que dice adónde lleva. El contador se va abajo
                cuando no entra al lado, que es mejor que cortar la palabra. */}
            <span className="relative inline-flex flex-wrap items-center justify-center gap-x-1 md:gap-x-1.5">
              <tab.icon
                aria-hidden
                className="hidden size-3.5 shrink-0 md:block"
              />
              {tab.label}
              {count > 0 ? (
                <span className="tabular-nums">({count})</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
