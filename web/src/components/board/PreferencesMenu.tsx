import { Check, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useT } from '../../hooks/useLocale.ts'
import type { Display } from '../../lib/display.ts'
import { LOCALES, isSelectable } from '../../lib/i18n.ts'
import { fadeUpTransition } from '../../lib/motion.ts'
import { menuItemClass, popoverClass } from '../../lib/styles.ts'
import { THEME_OPTIONS } from '../../lib/theme-options.ts'
import type { Theme } from '../../lib/types.ts'

interface PreferencesButtonProps {
  open: boolean
  /** La página de Configuración está abierta: el botón se ve encendido. */
  active: boolean
  onToggle: () => void
  onPrefetch: () => void
}

/** El botón de la isla. Abre el menú; no navega. */
export function PreferencesButton({
  open,
  active,
  onToggle,
  onPrefetch,
}: PreferencesButtonProps) {
  const t = useT()
  const lit = active || open

  return (
    <m.button
      layout
      aria-current={active ? 'page' : undefined}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={t('island.preferences')}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors sm:px-3 w-8 sm:w-auto ${
        lit
          ? 'bg-sky text-ink hover:bg-sky/80'
          : 'bg-onpanel-wash text-onpanel/80 hover:bg-onpanel/20 hover:text-onpanel'
      }`}
      type="button"
      onClick={onToggle}
      onFocus={onPrefetch}
      onMouseEnter={onPrefetch}
      onPointerDown={onPrefetch}
    >
      <SlidersHorizontal aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">{t('island.preferences')}</span>
    </m.button>
  )
}

interface PreferencesPopoverProps {
  open: boolean
  theme: Theme
  display: Display
  onChangeTheme: (theme: Theme) => void
  onChangeDisplay: (display: Display) => void
  onOpenSettings: () => void
  onPrefetchSettings: () => void
  onClose: () => void
}

const groupLabelClass =
  'px-2.5 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase'

/**
 * El menú de Preferencias: tema e idioma se eligen ahí mismo y Configuración
 * lleva a la página. Lo dibuja la isla fuera del `header` (que recorta lo que
 * se sale), colgado del borde derecho.
 */
export function PreferencesPopover({
  open,
  theme,
  display,
  onChangeTheme,
  onChangeDisplay,
  onOpenSettings,
  onPrefetchSettings,
  onClose,
}: PreferencesPopoverProps) {
  const t = useT()

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className={`${popoverClass} pointer-events-auto top-full right-0 mt-2 w-60`}
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: -4 }}
          role="menu"
          transition={fadeUpTransition}
        >
          <div aria-label={t('menu.theme')} role="group">
            <p aria-hidden className={groupLabelClass}>
              {t('menu.theme')}
            </p>
            {THEME_OPTIONS.map((option) => {
              const selected = theme === option.value
              return (
                <button
                  key={option.value}
                  aria-checked={selected}
                  className={menuItemClass}
                  role="menuitemradio"
                  type="button"
                  onClick={() => onChangeTheme(option.value)}
                >
                  <option.icon
                    aria-hidden
                    className="size-3.5 shrink-0 text-brand"
                  />
                  <span className="flex-1">{t(option.label)}</span>
                  {selected ? (
                    <Check aria-hidden className="size-3.5 text-brand" />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div
            aria-label={t('menu.language')}
            className="mt-1 border-t border-line pt-1"
            role="group"
          >
            <p aria-hidden className={groupLabelClass}>
              {t('menu.language')}
            </p>
            {LOCALES.map((language) => {
              const selectable = isSelectable(language.code)
              const selected = display.locale === language.code
              return (
                <button
                  key={language.code}
                  aria-checked={selected}
                  className={`${menuItemClass} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-soft`}
                  disabled={!selectable}
                  role="menuitemradio"
                  type="button"
                  onClick={() =>
                    onChangeDisplay({ ...display, locale: language.code })
                  }
                >
                  <span className="flex-1">{language.label}</span>
                  {selectable ? null : (
                    <span className="text-[0.6875rem] text-muted">
                      {t('menu.soon')}
                    </span>
                  )}
                  {selected ? (
                    <Check aria-hidden className="size-3.5 text-brand" />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-1 border-t border-line pt-1">
            <button
              className={menuItemClass}
              role="menuitem"
              type="button"
              onClick={() => {
                onClose()
                onOpenSettings()
              }}
              onFocus={onPrefetchSettings}
              onMouseEnter={onPrefetchSettings}
              onPointerDown={onPrefetchSettings}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{t('menu.settings')}</span>
                <span className="truncate text-[0.6875rem] font-normal text-muted">
                  {t('menu.settingsHint')}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-3.5 text-muted" />
            </button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
