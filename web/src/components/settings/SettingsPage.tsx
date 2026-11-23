import {
  ChevronRight,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
} from 'lucide-react'
import { type ReactNode, useId } from 'react'
import { type Display, SCALES } from '../../lib/display.ts'
import type { Theme } from '../../lib/types.ts'
import { PageHeader } from '../page/PageHeader.tsx'
import { PanelSection } from '../page/PanelSection.tsx'
import { PanelChip, PanelGroup } from '../profile/PanelControls.tsx'

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

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

/** Los idiomas que la app va a tener. Hoy hay uno solo: los demás figuran para
 * que se vea qué viene, pero no se pueden elegir ni tienen texto inventado. */
const LANGUAGES = [
  { code: 'es', label: 'Español', ready: true },
  { code: 'en', label: 'English', ready: false },
  { code: 'pt', label: 'Português', ready: false },
] as const

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
 * accesibilidad. Nada de esto es de la búsqueda ni del perfil (eso vive en
 * `?view=profile`), y nada sale del navegador: ni se sincroniza con la cuenta
 * ni se manda a la API.
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
  const set = <K extends keyof Display>(key: K, value: Display[K]) =>
    onChangeDisplay({ ...display, [key]: value })

  return (
    <div className="mt-6 space-y-5">
      <PageHeader
        icon={<SlidersHorizontal aria-hidden className="size-5" />}
        lead="Idioma, tema, tamaño y accesibilidad. Se guardan en este dispositivo y no viajan a tu cuenta."
        title="Preferencias"
        onBack={onBack}
      />

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
            Perfil y configuración
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            Tu perfil, tu CV, qué buscás, las fuentes, tu cuenta y la
            privacidad.
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
        />
      </button>

      <PanelSection
        hint="El idioma de la interfaz. Las ofertas se muestran en el idioma en que se publicaron."
        id="idioma"
        title="Idioma"
      >
        <PanelGroup title="Interfaz">
          {LANGUAGES.map((language) => (
            <PanelChip
              key={language.code}
              active={language.code === 'es'}
              disabled={!language.ready}
              onClick={() => undefined}
            >
              {language.label}
              {language.ready ? null : (
                <span className="text-[0.6875rem] font-normal">· pronto</span>
              )}
            </PanelChip>
          ))}
        </PanelGroup>
      </PanelSection>

      <PanelSection
        hint="Claro u oscuro, o el que use tu dispositivo."
        id="tema"
        title="Tema"
      >
        <PanelGroup title="Aspecto">
          {THEME_OPTIONS.map((option) => (
            <PanelChip
              key={option.value}
              active={theme === option.value}
              onClick={() => onChangeTheme(option.value)}
            >
              <option.icon aria-hidden className="size-3.5" />
              {option.label}
            </PanelChip>
          ))}
        </PanelGroup>
      </PanelSection>

      <PanelSection
        hint="Agranda o achica el texto y todo lo que se mide con él: botones, tarjetas y espacios."
        id="escala"
        title="Escala"
      >
        <PanelGroup title="Tamaño">
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

      <PanelSection
        hint="Suman a lo que ya pide tu sistema operativo: nunca lo quitan."
        id="accesibilidad"
        title="Accesibilidad"
      >
        <ul className="space-y-5">
          <Switch
            checked={display.reduceMotion}
            hint="Sin animaciones ni transiciones: lo que cambia aparece de una."
            label="Reducir movimiento"
            onChange={(value) => set('reduceMotion', value)}
          />
          <Switch
            checked={display.highContrast}
            hint="Texto, bordes y enlaces más marcados, en el tema claro y en el oscuro."
            label="Alto contraste"
            onChange={(value) => set('highContrast', value)}
          />
          <Switch
            checked={display.underlineLinks}
            hint="Todos los enlaces van subrayados, no solo los de un párrafo."
            label="Subrayar enlaces"
            onChange={(value) => set('underlineLinks', value)}
          />
        </ul>
      </PanelSection>
    </div>
  )
}
