import {
  Accessibility,
  ChevronRight,
  Languages,
  Palette,
  SlidersHorizontal,
  Sun,
} from 'lucide-react'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { useT } from '../../hooks/useLocale.ts'
import { type Display, SCALES } from '../../lib/display.ts'
import { LOCALES, isSelectable } from '../../lib/i18n.ts'
import type { MessageKey } from '../../lib/i18n.ts'
import { THEME_OPTIONS } from '../../lib/theme-options.ts'
import type { Theme } from '../../lib/types.ts'
import { PageHeader } from '../page/PageHeader.tsx'
import { PanelSection } from '../page/PanelSection.tsx'
import { PanelChip, PanelGroup } from '../profile/PanelControls.tsx'
import { Tabs } from '../ui/Tabs.tsx'

interface SettingsPageProps {
  theme: Theme
  display: Display
  onChangeTheme: (theme: Theme) => void
  onChangeDisplay: (display: Display) => void
  /** Lleva al perfil, donde viven los datos y la búsqueda. */
  onOpenProfile: () => void
  onPrefetchProfile: () => void
  onBack: () => void
}

type SettingsTab = 'apariencia' | 'idioma' | 'accesibilidad'

const TABS: { value: SettingsTab; label: MessageKey; icon: typeof Sun }[] = [
  { value: 'apariencia', label: 'settings.tab.appearance', icon: Palette },
  { value: 'idioma', label: 'settings.tab.language', icon: Languages },
  {
    value: 'accesibilidad',
    label: 'settings.tab.accessibility',
    icon: Accessibility,
  },
]

/** Las anclas de antes de las pestañas (`#tema`, `#escala`) siguen abriendo
 * donde quedó lo que nombran. */
const ANCHORS: Record<string, SettingsTab> = {
  apariencia: 'apariencia',
  tema: 'apariencia',
  escala: 'apariencia',
  idioma: 'idioma',
  accesibilidad: 'accesibilidad',
}

const tabFromHash = (): SettingsTab => {
  const anchor = window.location.hash.slice(1)
  return Object.hasOwn(ANCHORS, anchor)
    ? (ANCHORS[anchor] ?? 'apariencia')
    : 'apariencia'
}

/** Un interruptor con su explicación al lado: lo que hace y cuándo conviene. */
function Switch({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean
  label: string
  hint: ReactNode
  onChange: (checked: boolean) => void
}) {
  const hintId = useId()

  return (
    <li className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-onpanel">{label}</p>
        <p
          className="mt-0.5 text-xs leading-relaxed text-onpanel-muted"
          id={hintId}
        >
          {hint}
        </p>
      </div>
      <button
        aria-checked={checked}
        aria-describedby={hintId}
        aria-label={label}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky ${
          checked ? 'bg-sky' : 'bg-onpanel-wash'
        }`}
        role="switch"
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span
          aria-hidden
          className={`absolute top-1 left-1 size-5 rounded-full transition-transform ${
            checked ? 'translate-x-5 bg-ink' : 'bg-onpanel'
          }`}
        />
      </button>
    </li>
  )
}

/**
 * Cómo se ve y cómo se mueve la app en este dispositivo: idioma, tema, escala y
 * accesibilidad. Va en pestañas para que nada quede al fondo de un scroll; la
 * elegida queda en el ancla (`?view=settings#accesibilidad`), así un enlace
 * abre la sección justa. Nada de esto es de la búsqueda ni del perfil (eso
 * vive en `?view=profile`), y nada sale del navegador.
 */
export function SettingsPage({
  theme,
  display,
  onChangeTheme,
  onChangeDisplay,
  onOpenProfile,
  onPrefetchProfile,
  onBack,
}: SettingsPageProps) {
  const t = useT()
  const [tab, setTab] = useState<SettingsTab>(tabFromHash)
  const set = <K extends keyof Display>(key: K, value: Display[K]) =>
    onChangeDisplay({ ...display, [key]: value })

  /* La pestaña va al ancla sin sumar un paso al historial: Atrás sigue
     volviendo al listado, no recorriendo las pestañas. */
  useEffect(() => {
    const url = new URL(window.location.href)
    url.hash = tab
    window.history.replaceState(window.history.state, '', url)
  }, [tab])

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="mt-6 space-y-5">
      <PageHeader
        icon={<SlidersHorizontal aria-hidden className="size-5" />}
        lead={t('settings.lead')}
        title={t('settings.title')}
        onBack={onBack}
      />

      <Tabs
        label={t('settings.sections')}
        layoutId="settings-tab"
        options={TABS.map((entry) => ({
          value: entry.value,
          label: t(entry.label),
          icon: entry.icon,
        }))}
        value={tab}
        onChange={setTab}
      />

      {tab === 'apariencia' ? (
        <>
          <PanelSection
            hint={t('settings.theme.hint')}
            id="tema"
            title={t('settings.theme.title')}
          >
            <PanelGroup title={t('settings.theme.group')}>
              {THEME_OPTIONS.map((option) => (
                <PanelChip
                  key={option.value}
                  active={theme === option.value}
                  onClick={() => onChangeTheme(option.value)}
                >
                  <option.icon aria-hidden className="size-3.5" />
                  {t(option.label)}
                </PanelChip>
              ))}
            </PanelGroup>
          </PanelSection>

          <PanelSection
            hint={t('settings.scale.hint')}
            id="escala"
            title={t('settings.scale.title')}
          >
            <PanelGroup title={t('settings.scale.group')}>
              {SCALES.map((scale) => (
                <PanelChip
                  key={scale}
                  active={display.scale === scale}
                  onClick={() => set('scale', scale)}
                >
                  {scale} %
                </PanelChip>
              ))}
            </PanelGroup>
          </PanelSection>
        </>
      ) : null}

      {tab === 'idioma' ? (
        <PanelSection
          hint={t('settings.language.hint')}
          id="idioma"
          title={t('settings.tab.language')}
        >
          <PanelGroup title={t('settings.language.group')}>
            {LOCALES.map((language) => {
              const selectable = isSelectable(language.code)
              return (
                <PanelChip
                  key={language.code}
                  active={display.locale === language.code}
                  disabled={!selectable}
                  onClick={() => set('locale', language.code)}
                >
                  <span lang={language.lang}>{language.label}</span>
                  {language.ready ? null : (
                    <span className="text-[0.6875rem] font-normal">
                      · {t('menu.soon')}
                    </span>
                  )}
                </PanelChip>
              )
            })}
          </PanelGroup>
        </PanelSection>
      ) : null}

      {tab === 'accesibilidad' ? (
        <PanelSection
          hint={t('settings.a11y.hint')}
          id="accesibilidad"
          title={t('settings.tab.accessibility')}
        >
          <ul className="space-y-5">
            <Switch
              checked={display.reduceMotion}
              hint={t('settings.a11y.motionHint')}
              label={t('settings.a11y.motion')}
              onChange={(value) => set('reduceMotion', value)}
            />
            <Switch
              checked={display.highContrast}
              hint={t('settings.a11y.contrastHint')}
              label={t('settings.a11y.contrast')}
              onChange={(value) => set('highContrast', value)}
            />
            <Switch
              checked={display.underlineLinks}
              hint={t('settings.a11y.linksHint')}
              label={t('settings.a11y.links')}
              onChange={(value) => set('underlineLinks', value)}
            />
          </ul>
        </PanelSection>
      ) : null}

      <button
        className="group flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-hairline)] transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        type="button"
        onClick={onOpenProfile}
        onFocus={onPrefetchProfile}
        onMouseEnter={onPrefetchProfile}
        onPointerDown={onPrefetchProfile}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            {t('settings.profile.title')}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {t('settings.profile.hint')}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </div>
  )
}
