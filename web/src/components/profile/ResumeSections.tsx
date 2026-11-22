import { Download, Search } from 'lucide-react'
import { useId, useState } from 'react'
import type { Profile } from '../../lib/profile.ts'
import {
  DEPARTMENT_NAMES,
  type Resume,
  buildExport,
  exportFileName,
} from '../../lib/resume.ts'
import type { JobType, Level, Preferences, WorkMode } from '../../lib/types.ts'
import { toggleValue } from '../../lib/types.ts'
import { DisabilityField } from './DisabilityField.tsx'
import { LanguagesField } from './LanguagesField.tsx'
import { LinksField } from './LinksField.tsx'
import {
  PanelChip,
  PanelField,
  PanelGroup,
  panelButtonClass,
  panelInputClass,
} from './PanelControls.tsx'
import { PanelSection } from './PanelSection.tsx'
import { PhotoField } from './PhotoField.tsx'
import { ReferencesField } from './ReferencesField.tsx'

interface ResumeSectionsProps {
  resume: Resume
  profile: Profile
  preferences: Preferences
  onChange: (resume: Resume) => void
  onChangePreferences: (preferences: Preferences) => void
  /** Lleva al tablero con el puesto y la jornada cargados como filtros. */
  onSearchBoard: () => void
}

type SectionKey =
  | 'place'
  | 'languages'
  | 'search'
  | 'links'
  | 'references'
  | 'disability'

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: 'entry', label: 'Junior' },
  { value: 'mid', label: 'Semi senior' },
  { value: 'senior', label: 'Senior' },
]

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Jornada completa' },
  { value: 'part_time', label: 'Medio horario' },
  { value: 'internship', label: 'Pasantía' },
]

const MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: 'onsite', label: 'Presencial' },
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
]

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

/**
 * El resto del perfil, el que se parece a un CV: foto, dónde vive, idiomas,
 * qué busca, links, referencias y, si quiere, discapacidad. Cada bloque es una
 * sección cerrada con un resumen, para que el panel siga siendo corto. Todo
 * queda en este navegador; lo único que lo saca es el botón de descargar.
 */
export function ResumeSections({
  resume,
  profile,
  preferences,
  onChange,
  onChangePreferences,
  onSearchBoard,
}: ResumeSectionsProps) {
  const id = useId()
  const [open, setOpen] = useState<SectionKey | null>(null)
  const [withDisability, setWithDisability] = useState(true)
  const toggle = (key: SectionKey) =>
    setOpen((current) => (current === key ? null : key))
  const set = (patch: Partial<Resume>) => onChange({ ...resume, ...patch })

  const download = () => {
    const now = new Date()
    const file = buildExport(profile, preferences, resume, now, withDisability)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName(now)
    link.click()
    URL.revokeObjectURL(url)
  }

  const searchSummary = [
    resume.role,
    resume.lead ? 'Jefatura' : '',
    ...LEVEL_OPTIONS.filter((o) => preferences.levels.includes(o.value)).map(
      (o) => o.label,
    ),
  ]
    .filter((part) => part !== '')
    .join(', ')

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        Tu CV
      </p>

      <PanelSection
        open={open === 'place'}
        summary={[resume.photo === '' ? '' : 'Foto', resume.department]
          .filter((part) => part !== '')
          .join(', ')}
        title="Foto y ubicación"
        onToggle={() => toggle('place')}
      >
        <PhotoField value={resume.photo} onChange={(photo) => set({ photo })} />
        <PanelGroup title="Departamento">
          {DEPARTMENT_NAMES.map((name) => (
            <PanelChip
              key={name}
              active={resume.department === name}
              onClick={() =>
                set({ department: resume.department === name ? '' : name })
              }
            >
              {name}
            </PanelChip>
          ))}
        </PanelGroup>
        <PanelField
          hint="Barrio o ciudad. No pongas tu dirección."
          htmlFor={`${id}-city`}
          label="Ciudad o barrio"
        >
          <input
            autoComplete="off"
            className={panelInputClass}
            id={`${id}-city`}
            maxLength={60}
            type="text"
            value={resume.city}
            onChange={(event) => set({ city: event.target.value })}
          />
        </PanelField>
      </PanelSection>

      <PanelSection
        open={open === 'languages'}
        summary={
          resume.languages.length === 0
            ? ''
            : resume.languages.map((language) => language.name).join(', ')
        }
        title="Idiomas"
        onToggle={() => toggle('languages')}
      >
        <LanguagesField
          value={resume.languages}
          onChange={(languages) => set({ languages })}
        />
      </PanelSection>

      <PanelSection
        open={open === 'search'}
        summary={searchSummary}
        title="Puesto y preferencias"
        onToggle={() => toggle('search')}
      >
        <PanelField
          hint="Con esto el tablero filtra por título."
          htmlFor={`${id}-role`}
          label="Puesto que buscás"
        >
          <input
            autoComplete="off"
            className={panelInputClass}
            id={`${id}-role`}
            maxLength={80}
            placeholder="Cajero, desarrolladora, chofer…"
            type="text"
            value={resume.role}
            onChange={(event) => set({ role: event.target.value })}
          />
        </PanelField>

        <PanelGroup title="Jerarquía">
          {LEVEL_OPTIONS.map((option) => (
            <PanelChip
              key={option.value}
              active={preferences.levels.includes(option.value)}
              onClick={() =>
                onChangePreferences({
                  ...preferences,
                  levels: toggleValue(preferences.levels, option.value),
                })
              }
            >
              {option.label}
            </PanelChip>
          ))}
          <PanelChip
            active={resume.lead}
            onClick={() => set({ lead: !resume.lead })}
          >
            Jefatura
          </PanelChip>
        </PanelGroup>

        <PanelGroup title="Jornada">
          {JOB_TYPE_OPTIONS.map((option) => (
            <PanelChip
              key={option.value}
              active={preferences.jobTypes.includes(option.value)}
              onClick={() =>
                onChangePreferences({
                  ...preferences,
                  jobTypes: toggleValue(preferences.jobTypes, option.value),
                })
              }
            >
              {option.label}
            </PanelChip>
          ))}
        </PanelGroup>

        <PanelGroup title="Modalidad">
          {MODE_OPTIONS.map((option) => (
            <PanelChip
              key={option.value}
              active={preferences.modes.includes(option.value)}
              onClick={() =>
                onChangePreferences({
                  ...preferences,
                  modes: toggleValue(preferences.modes, option.value),
                })
              }
            >
              {option.label}
            </PanelChip>
          ))}
        </PanelGroup>

        <div className="space-y-1.5">
          <button
            className={panelButtonClass}
            type="button"
            onClick={onSearchBoard}
          >
            <Search aria-hidden className="size-3.5" />
            Ver ofertas con esto
          </button>
          <p className="text-[11px] leading-relaxed text-onpanel-faint">
            Si marcás más de una opción en un grupo, esas ordenan “Para vos”
            pero no recortan el listado. Jefatura no filtra: los avisos no traen
            ese dato.
          </p>
        </div>
      </PanelSection>

      <PanelSection
        open={open === 'links'}
        summary={
          resume.links.length === 0
            ? ''
            : plural(resume.links.length, 'link', 'links')
        }
        title="Web y redes"
        onToggle={() => toggle('links')}
      >
        <LinksField value={resume.links} onChange={(links) => set({ links })} />
      </PanelSection>

      <PanelSection
        open={open === 'references'}
        summary={
          resume.references.length === 0
            ? ''
            : plural(resume.references.length, 'referencia', 'referencias')
        }
        title="Referencias"
        onToggle={() => toggle('references')}
      >
        <ReferencesField
          value={resume.references}
          onChange={(references) => set({ references })}
        />
      </PanelSection>

      <PanelSection
        open={open === 'disability'}
        summary={resume.disability.declared ? 'Anotada' : ''}
        title="Discapacidad (opcional)"
        onToggle={() => toggle('disability')}
      >
        <DisabilityField
          value={resume.disability}
          onChange={(disability) => set({ disability })}
        />
      </PanelSection>

      <div className="space-y-2 border-t border-onpanel/10 pt-3">
        <button className={panelButtonClass} type="button" onClick={download}>
          <Download aria-hidden className="size-3.5" />
          Descargar mis datos (JSON)
        </button>
        {resume.disability.declared ? (
          <label className="flex min-h-11 cursor-pointer items-start gap-2.5 sm:min-h-0">
            <input
              checked={withDisability}
              className="mt-0.5 size-3.5 shrink-0 accent-sky"
              type="checkbox"
              onChange={(event) => setWithDisability(event.target.checked)}
            />
            <span className="text-[11px] leading-relaxed text-onpanel/75">
              Incluir lo de discapacidad en el archivo
            </span>
          </label>
        ) : null}
        <p className="text-[11px] leading-relaxed text-onpanel-faint">
          El archivo se arma en tu navegador y se descarga a tu equipo. No pasa
          por ningún servidor.
        </p>
      </div>
    </div>
  )
}
