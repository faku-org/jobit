import {
  Accessibility,
  ArrowLeft,
  Languages,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../hooks/useLocale.ts'
import { type Display, SCALES } from '../../lib/display.ts'
import { LOCALES, type MessageKey, isSelectable } from '../../lib/i18n.ts'
import { THEME_OPTIONS } from '../../lib/theme-options.ts'
import type { Theme } from '../../lib/types.ts'
import { PanelChip, PanelGroup } from '../profile/PanelControls.tsx'
import {
  PROFILE_SECTIONS,
  type ProfileSectionId,
} from '../profile/profile-sections.ts'
import {
  type ProfileProps,
  ProfileSection,
} from '../profile/ProfileSections.tsx'
import { Tabs } from '../ui/Tabs.tsx'
import { ConfigPanel } from './ConfigPanel.tsx'

type SettingsPageProps = ProfileProps & {
  theme: Theme
  display: Display
  onChangeTheme: (theme: Theme) => void
  onChangeDisplay: (display: Display) => void
  onBack: () => void
}

type TopTab = 'perfil' | 'apariencia' | 'idioma' | 'accesibilidad'

const TABS: { value: TopTab; label: MessageKey; icon: typeof Sun }[] = [
  { value: 'perfil', label: 'settings.tab.profile', icon: UserRound },
  { value: 'apariencia', label: 'settings.tab.appearance', icon: Palette },
  { value: 'idioma', label: 'settings.tab.language', icon: Languages },
  {
    value: 'accesibilidad',
    label: 'settings.tab.accessibility',
    icon: Accessibility,
  },
]

interface Place {
  tab: TopTab
  section: ProfileSectionId
}

const DEFAULT_PLACE: Place = { tab: 'perfil', section: 'perfil' }

/** Las anclas de antes siguen abriendo donde quedó lo que nombran: `#tema` y
 * `#escala` son Apariencia, `#preferencias` (del perfil) es Búsqueda. */
const ALIASES: Record<string, string> = {
  tema: 'apariencia',
  escala: 'apariencia',
  preferencias: 'busqueda',
}

const isSection = (id: string): id is ProfileSectionId =>
  PROFILE_SECTIONS.some((section) => section.id === id)

const isTopTab = (id: string): id is TopTab =>
  TABS.some((tab) => tab.value === id)

/** El ancla nombra una pestaña o una sección del perfil; nada, el perfil. */
function placeFromHash(previous: Place = DEFAULT_PLACE): Place {
  const raw = window.location.hash.slice(1)
  const anchor = Object.hasOwn(ALIASES, raw) ? (ALIASES[raw] ?? raw) : raw
  if (isSection(anchor)) return { tab: 'perfil', section: anchor }
  if (isTopTab(anchor) && anchor !== 'perfil')
    return { tab: anchor, section: previous.section }
  return previous
}

const hashOf = (place: Place): string =>
  place.tab === 'perfil' ? place.section : place.tab

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
    <div className="flex items-start justify-between gap-4">
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
    </div>
  )
}

/**
 * Configuración: el perfil (con sus sub-secciones) y cómo se ve la app, en una
 * sola barra. La página tiene el alto de la ventana y ninguna sección scrollea:
 * lo que no entra en una columna sigue en la de al lado (`ConfigPanel`). Dónde
 * se está va en el ancla (`?view=settings#cv`, `#accesibilidad`), con
 * `replaceState` para que Atrás siga volviendo al listado.
 */
export function SettingsPage({
  theme,
  display,
  onChangeTheme,
  onChangeDisplay,
  onBack,
  ...profileProps
}: SettingsPageProps) {
  const t = useT()
  const heading = useRef<HTMLHeadingElement>(null)
  const [place, setPlace] = useState<Place>(() => placeFromHash())
  const set = <K extends keyof Display>(key: K, value: Display[K]) =>
    onChangeDisplay({ ...display, [key]: value })

  useEffect(() => {
    if (!window.location.hash) heading.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.hash = hashOf(place)
    window.history.replaceState(window.history.state, '', url)
  }, [place])

  useEffect(() => {
    const onHashChange = () => setPlace((current) => placeFromHash(current))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="mt-2 flex flex-col gap-3 md:h-[calc(100dvh-8.5rem)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          aria-label="Volver a las ofertas"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow-hairline)] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <h1
          ref={heading}
          className="text-xl font-semibold tracking-tight text-ink outline-none"
          tabIndex={-1}
        >
          {t('settings.title')}
        </h1>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-brand" />
          {t('settings.privacyNote')}
        </p>
      </div>

      <Tabs
        label={t('settings.sections')}
        layoutId="settings-tab"
        options={TABS.map((entry) => ({
          value: entry.value,
          label: t(entry.label),
          icon: entry.icon,
        }))}
        value={place.tab}
        onChange={(tab) => setPlace((current) => ({ ...current, tab }))}
      />

      {place.tab === 'perfil' ? (
        <>
          <Tabs
            label={t('settings.subsections')}
            layoutId="settings-subtab"
            options={PROFILE_SECTIONS.map((entry) => ({
              value: entry.id,
              label: t(entry.label),
            }))}
            value={place.section}
            onChange={(section) =>
              setPlace((current) => ({ ...current, section }))
            }
          />
          <ProfileSection section={place.section} {...profileProps} />
        </>
      ) : null}

      {place.tab === 'apariencia' ? (
        <ConfigPanel
          hint={t('settings.theme.hint')}
          id="apariencia"
          title={t('settings.tab.appearance')}
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
          <div>
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
            <p className="mt-2 text-xs leading-relaxed text-onpanel-muted">
              {t('settings.scale.hint')}
            </p>
          </div>
        </ConfigPanel>
      ) : null}

      {place.tab === 'idioma' ? (
        <ConfigPanel
          hint={t('settings.language.hint')}
          id="idioma"
          title={t('settings.tab.language')}
        >
          <PanelGroup title={t('settings.language.group')}>
            {LOCALES.map((language) => (
              <PanelChip
                key={language.code}
                active={display.locale === language.code}
                disabled={!isSelectable(language.code)}
                onClick={() => set('locale', language.code)}
              >
                <span lang={language.lang}>{language.label}</span>
                {language.ready ? null : (
                  <span className="text-[0.6875rem] font-normal">
                    · {t('menu.soon')}
                  </span>
                )}
              </PanelChip>
            ))}
          </PanelGroup>
        </ConfigPanel>
      ) : null}

      {place.tab === 'accesibilidad' ? (
        <ConfigPanel
          hint={t('settings.a11y.hint')}
          id="accesibilidad"
          title={t('settings.tab.accessibility')}
        >
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
        </ConfigPanel>
      ) : null}
    </div>
  )
}
