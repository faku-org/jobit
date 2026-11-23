import {
  CalendarArrowDown,
  Focus,
  Layers,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Target,
} from 'lucide-react'
import type { CustomFeed, FeedResult } from '../../lib/feed.ts'
import {
  SOURCE_LABEL,
  formatScrapedAt,
  pluralOffers,
} from '../../lib/format.ts'
import type {
  Facet,
  JobType,
  Level,
  Meta,
  Mix,
  Preferences,
  WorkMode,
} from '../../lib/types.ts'
import {
  EMPTY_PREFERENCES,
  categoryStances,
  departmentStances,
  hiddenCount,
  preferenceCount,
  toggleValue,
  withCategoryStances,
  withDepartmentStances,
} from '../../lib/types.ts'
import { CustomSources } from './CustomSources.tsx'
import {
  PanelChip as Chip,
  PanelGroup as Group,
  StanceChips,
} from './PanelControls.tsx'
import { PriorityList } from './PriorityList.tsx'
import { SalaryRange } from './SalaryRange.tsx'

interface PreferencesPanelProps {
  meta: Meta | null
  categories: Facet[]
  departments: Facet[]
  preferences: Preferences
  onChange: (preferences: Preferences) => void
}

interface SourcesPanelProps {
  meta: Meta | null
  /** Chosen job boards; empty means every source the API offers. */
  sources: string[]
  /** Extra feeds this browser reads on its own. */
  feeds: CustomFeed[]
  feedResults: FeedResult[]
  feedsLoading: boolean
  onChangeSources: (sources: string[]) => void
  onChangeFeeds: (feeds: CustomFeed[]) => void
}

const MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: 'onsite', label: 'Presencial' },
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
]

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

const MIX_OPTIONS: {
  value: Mix
  label: string
  hint: string
  icon: typeof Shuffle
}[] = [
  {
    value: 'broad',
    label: 'Más variedad',
    hint: 'Marca todas las que coinciden y sube ofertas nuevas de otros rubros.',
    icon: Shuffle,
  },
  {
    value: 'balanced',
    label: 'Equilibrio',
    hint: '“Para vos” queda para las que mejor te calzan, no para todas las del rubro.',
    icon: Layers,
  },
  {
    value: 'focused',
    label: 'Más precisas',
    hint: 'Pocas marcadas y bien arriba. El resto no desaparece, solo deja de llevar el sello.',
    icon: Focus,
  },
]

/**
 * Sources are stored as an explicit list, with the empty list meaning "all", so
 * a new job board starts included. Turning the last one off goes back to all.
 */
function toggleSource(
  current: string[],
  all: string[],
  value: string,
): string[] {
  const selected = current.length === 0 ? all : current
  const next = toggleValue(selected, value)
  return next.length === 0 || next.length === all.length ? [] : next
}

const labelFrom = (facets: Facet[]) => (value: string) =>
  facets.find((facet) => facet.value === value)?.label

/**
 * Lives in the profile page: what the person is looking for and where the offers
 * come from. Ten groups in a row were a form nobody finished, so the questions
 * are grouped by theme and follow the order the onboarding asks them in.
 */
export function PreferencesPanel({
  meta,
  categories,
  departments,
  preferences,
  onChange,
}: PreferencesPanelProps) {
  const count = preferenceCount(preferences)
  const hidden = hiddenCount(preferences)

  return (
    <>
      <Group title="Orden del listado">
        <Chip
          active={preferences.rankByFit}
          onClick={() => onChange({ ...preferences, rankByFit: true })}
        >
          <Target aria-hidden className="size-3.5" />
          Lo que mejor te calza
        </Chip>
        <Chip
          active={!preferences.rankByFit}
          onClick={() => onChange({ ...preferences, rankByFit: false })}
        >
          <CalendarArrowDown aria-hidden className="size-3.5" />
          Lo más nuevo
        </Chip>
        <p className="w-full text-[0.6875rem] leading-snug text-onpanel-faint">
          Con la primera, tus rubros, zona, sueldo y perfil deciden el orden.
          Nada se descarta: solo baja de lugar.
        </p>
      </Group>

      <Group title="Precisión del calce">
        {MIX_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <Chip
              key={option.value}
              active={preferences.mix === option.value}
              onClick={() => onChange({ ...preferences, mix: option.value })}
            >
              <Icon aria-hidden className="size-3.5" />
              {option.label}
            </Chip>
          )
        })}
        <p className="w-full text-[0.6875rem] leading-snug text-onpanel-faint">
          {MIX_OPTIONS.find((option) => option.value === preferences.mix)?.hint}
        </p>
      </Group>

      <Group title="Modalidad">
        {MODE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={preferences.modes.includes(option.value)}
            onClick={() =>
              onChange({
                ...preferences,
                modes: toggleValue(preferences.modes, option.value),
              })
            }
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      <Group title="Jornada">
        {JOB_TYPE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={preferences.jobTypes.includes(option.value)}
            onClick={() =>
              onChange({
                ...preferences,
                jobTypes: toggleValue(preferences.jobTypes, option.value),
              })
            }
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      <StanceChips
        facets={categories}
        hint="Tocá: priorizar, ocultar o neutro."
        lists={categoryStances(preferences)}
        title="Rubros"
        onChange={(lists) => onChange(withCategoryStances(preferences, lists))}
      />

      {preferences.categories.length > 1 ? (
        <PriorityList
          empty=""
          labelOf={labelFrom(categories)}
          title="Tu orden de rubros"
          values={preferences.categories}
          onChange={(values) =>
            onChange({ ...preferences, categories: values })
          }
        />
      ) : null}

      <Group title="Nivel">
        {LEVEL_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={preferences.levels.includes(option.value)}
            onClick={() =>
              onChange({
                ...preferences,
                levels: toggleValue(preferences.levels, option.value),
              })
            }
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      <StanceChips
        facets={departments.slice(0, 19)}
        hint="Priorizá dónde querés trabajar y ocultá lo que no te sirve."
        lists={departmentStances(preferences)}
        title="Zona"
        onChange={(lists) =>
          onChange(withDepartmentStances(preferences, lists))
        }
      />

      {preferences.departments.length > 1 ? (
        <PriorityList
          empty=""
          labelOf={labelFrom(departments)}
          title="Tu orden de zonas"
          values={preferences.departments}
          onChange={(values) =>
            onChange({ ...preferences, departments: values })
          }
        />
      ) : null}

      <SalaryRange
        value={preferences.salary}
        onChange={(salary) => onChange({ ...preferences, salary })}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.6875rem] leading-snug text-onpanel-muted">
          {meta ? (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw aria-hidden className="size-3" />
              {pluralOffers(meta.count)} · actualizado{' '}
              {formatScrapedAt(meta.scraped_at)}
            </span>
          ) : (
            'Las ofertas que coinciden quedan destacadas.'
          )}
        </p>
        {count > 0 || hidden > 0 ? (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[0.6875rem] font-medium text-onpanel/60 transition-colors hover:bg-onpanel-wash hover:text-onpanel"
            type="button"
            onClick={() => onChange(EMPTY_PREFERENCES)}
          >
            <RotateCcw aria-hidden className="size-3" />
            Borrar
          </button>
        ) : null}
      </div>
    </>
  )
}

/**
 * De dónde salen las ofertas: los portales que trae la API y, aparte, los
 * feeds propios. Es otra pregunta que la de qué se busca, y tiene su ancla.
 */
export function SourcesPanel({
  meta,
  sources,
  feeds,
  feedResults,
  feedsLoading,
  onChangeSources,
  onChangeFeeds,
}: SourcesPanelProps) {
  const allSources = meta?.sources ?? []

  return (
    <>
      {allSources.length > 0 ? (
        <Group title="De dónde salen las ofertas">
          {allSources.map((source) => (
            <Chip
              key={source}
              active={sources.length === 0 || sources.includes(source)}
              onClick={() =>
                onChangeSources(toggleSource(sources, allSources, source))
              }
            >
              {SOURCE_LABEL[source] ?? source}
            </Chip>
          ))}
        </Group>
      ) : (
        <p className="text-[0.6875rem] leading-relaxed text-onpanel-faint">
          Todavía no llegaron las fuentes del momento.
        </p>
      )}

      {/* Pide poder publicar un feed: es de otra liga que los portales. */}
      <CustomSources
        feeds={feeds}
        loading={feedsLoading}
        results={feedResults}
        onChange={onChangeFeeds}
      />
    </>
  )
}
