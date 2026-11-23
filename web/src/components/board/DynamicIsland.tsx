import { Bell, HelpCircle } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { useDismissable } from '../../hooks/useDismissable.ts'
import { useT } from '../../hooks/useLocale.ts'
import { useScrolledPast } from '../../hooks/useScrolledPast.ts'
import type { Display } from '../../lib/display.ts'
import { islandTransition } from '../../lib/motion.ts'
import type { Theme, View } from '../../lib/types.ts'
import { PreferencesButton, PreferencesPopover } from './PreferencesMenu.tsx'

interface DynamicIslandProps {
  /** La página abierta: su botón se ve encendido y avisa que es la actual. */
  view: View
  theme: Theme
  display: Display
  onChangeTheme: (theme: Theme) => void
  onChangeDisplay: (display: Display) => void
  onOpenNews: () => void
  onOpenHelp: () => void
  onOpenSettings: () => void
  /** Dejan la página cargada antes del clic. */
  onPrefetchNews: () => void
  onPrefetchHelp: () => void
  onPrefetchSettings: () => void
}

const iconButton = (active: boolean) =>
  `grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
    active
      ? 'bg-sky text-ink hover:bg-sky/80'
      : 'bg-onpanel-wash text-onpanel/80 hover:bg-onpanel/20 hover:text-onpanel'
  }`

/**
 * Un encabezado flotante, despegado del borde de la página: ancho en reposo y
 * reducido a una píldora cuando el listado scrollea. Lleva la marca y tres
 * accesos: novedades y ayuda son páginas con su enlace; Preferencias abre un
 * menú con tema e idioma a mano y, de ahí, la página de Configuración.
 */
export function DynamicIsland({
  view,
  theme,
  display,
  onChangeTheme,
  onChangeDisplay,
  onOpenNews,
  onOpenHelp,
  onOpenSettings,
  onPrefetchNews,
  onPrefetchHelp,
  onPrefetchSettings,
}: DynamicIslandProps) {
  const t = useT()
  const compact = useScrolledPast(24)
  const [menuOpen, setMenuOpen] = useState(false)
  // El contenedor abarca la isla y el menú: tocar el menú no cuenta como "afuera".
  const container = useDismissable<HTMLDivElement>(menuOpen, () =>
    setMenuOpen(false),
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4">
      <div
        ref={container}
        className={`relative w-full ${compact ? 'max-w-md' : 'max-w-3xl'}`}
      >
        {/* El header recorta lo que se sale (overflow-hidden); el menú cuelga
            del contenedor, fuera de él, para que no quede cortado. */}
        <m.header
          layout
          className="pointer-events-auto w-full overflow-hidden rounded-[26px] bg-panel text-onpanel shadow-[var(--shadow-panel)] ring-1 ring-onpanel/10 backdrop-blur-xl"
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
              <p className="text-[0.9375rem] leading-tight font-semibold tracking-tight">
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
                    {t('island.tagline')}
                  </m.p>
                )}
              </AnimatePresence>
            </m.div>

            <m.button
              layout
              aria-current={view === 'news' ? 'page' : undefined}
              aria-label={t('island.news')}
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
              aria-label={t('island.help')}
              className={iconButton(view === 'help')}
              type="button"
              onClick={onOpenHelp}
              onFocus={onPrefetchHelp}
              onMouseEnter={onPrefetchHelp}
              onPointerDown={onPrefetchHelp}
            >
              <HelpCircle aria-hidden className="size-4" />
            </m.button>

            <PreferencesButton
              active={view === 'settings'}
              open={menuOpen}
              onPrefetch={onPrefetchSettings}
              onToggle={() => setMenuOpen((current) => !current)}
            />
          </m.div>
        </m.header>

        <PreferencesPopover
          display={display}
          open={menuOpen}
          theme={theme}
          onChangeDisplay={onChangeDisplay}
          onChangeTheme={onChangeTheme}
          onClose={() => setMenuOpen(false)}
          onOpenSettings={onOpenSettings}
          onPrefetchSettings={onPrefetchSettings}
        />
      </div>
    </div>
  )
}
