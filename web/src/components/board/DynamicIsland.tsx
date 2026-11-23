import { Bell, HelpCircle, SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useScrolledPast } from '../../hooks/useScrolledPast.ts'
import { islandTransition } from '../../lib/motion.ts'
import type { View } from '../../lib/types.ts'

interface DynamicIslandProps {
  /** La página abierta: su botón se ve encendido y avisa que es la actual. */
  view: View
  /** Preferencias de búsqueda cargadas (y rubros o zonas ocultas). */
  count: number
  onOpenNews: () => void
  onOpenHelp: () => void
  onOpenProfile: () => void
  /** Dejan la página cargada antes del clic. */
  onPrefetchNews: () => void
  onPrefetchHelp: () => void
  onPrefetchProfile: () => void
}

const iconButton = (active: boolean) =>
  `grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
    active
      ? 'bg-sky text-ink hover:bg-sky/80'
      : 'bg-onpanel-wash text-onpanel/80 hover:bg-onpanel/20 hover:text-onpanel'
  }`

/**
 * Un encabezado flotante, despegado del borde de la página: ancho en reposo y
 * reducido a una píldora cuando el listado scrollea. Solo lleva la marca y tres
 * accesos —novedades, ayuda y perfil—, cada uno una página con su enlace: ya no
 * se despliega una hoja con todo adentro.
 */
export function DynamicIsland({
  view,
  count,
  onOpenNews,
  onOpenHelp,
  onOpenProfile,
  onPrefetchNews,
  onPrefetchHelp,
  onPrefetchProfile,
}: DynamicIslandProps) {
  const compact = useScrolledPast(24)
  const profileActive = view === 'profile'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4">
      <m.header
        layout
        className={`pointer-events-auto w-full overflow-hidden rounded-[26px] bg-panel text-onpanel shadow-[var(--shadow-panel)] ring-1 ring-onpanel/10 backdrop-blur-xl ${
          compact ? 'max-w-md' : 'max-w-3xl'
        }`}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={islandTransition}
      >
        <m.div
          layout
          className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4"
        >
          <m.span
            layout
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white"
          >
            <img
              alt="JobIt"
              className="size-full rounded-full"
              height={32}
              src="/icon-64.png"
              width={32}
            />
          </m.span>

          <m.div layout className="min-w-0 flex-1">
            <p className="text-[15px] leading-tight font-semibold tracking-tight">
              JobIt
            </p>
            <AnimatePresence initial={false} mode="popLayout">
              {compact ? null : (
                <m.p
                  key="full"
                  animate={{ opacity: 1 }}
                  className="truncate text-xs text-onpanel/60"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                >
                  Ofertas de trabajo en Uruguay
                </m.p>
              )}
            </AnimatePresence>
          </m.div>

          <m.button
            layout
            aria-current={view === 'news' ? 'page' : undefined}
            aria-label="Novedades"
            className={iconButton(view === 'news')}
            type="button"
            onClick={onOpenNews}
            onFocus={onPrefetchNews}
            onMouseEnter={onPrefetchNews}
            onPointerDown={onPrefetchNews}
          >
            <Bell aria-hidden className="size-4" />
          </m.button>

          <m.button
            layout
            aria-current={view === 'help' ? 'page' : undefined}
            aria-label="Ayuda"
            className={iconButton(view === 'help')}
            type="button"
            onClick={onOpenHelp}
            onFocus={onPrefetchHelp}
            onMouseEnter={onPrefetchHelp}
            onPointerDown={onPrefetchHelp}
          >
            <HelpCircle aria-hidden className="size-4" />
          </m.button>

          <m.button
            layout
            aria-current={profileActive ? 'page' : undefined}
            aria-label={
              count > 0
                ? `Perfil y preferencias (${count})`
                : 'Perfil y preferencias'
            }
            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors sm:px-3 ${
              count > 0 ? 'min-w-8 px-2' : 'w-8 sm:w-auto'
            } ${
              profileActive || count > 0
                ? 'bg-sky text-ink hover:bg-sky/80'
                : 'bg-onpanel-wash text-onpanel/80 hover:bg-onpanel/20 hover:text-onpanel'
            }`}
            type="button"
            onClick={onOpenProfile}
            onFocus={onPrefetchProfile}
            onMouseEnter={onPrefetchProfile}
            onPointerDown={onPrefetchProfile}
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Preferencias</span>
            {count > 0 ? <span className="tabular-nums">({count})</span> : null}
          </m.button>
        </m.div>
      </m.header>
    </div>
  )
}
