import { CalendarArrowDown, Monitor, Moon, RefreshCw, RotateCcw, Sun, Target } from "lucide-react";
import type { CustomFeed, FeedResult } from "../lib/feed.ts";
import { SOURCE_LABEL, formatScrapedAt, pluralOffers } from "../lib/format.ts";
import type { Facet, JobType, Level, Meta, Preferences, Theme, WorkMode } from "../lib/types.ts";
import {
  EMPTY_PREFERENCES,
  categoryStances,
  departmentStances,
  hiddenCount,
  preferenceCount,
  toggleValue,
  withCategoryStances,
  withDepartmentStances,
} from "../lib/types.ts";
import { CustomSources } from "./CustomSources.tsx";
import { PanelChip as Chip, PanelGroup as Group, StanceChips } from "./PanelControls.tsx";
import { PriorityList } from "./PriorityList.tsx";
import { SalaryRange } from "./SalaryRange.tsx";

interface PreferencesPanelProps {
  meta: Meta | null;
  categories: Facet[];
  departments: Facet[];
  preferences: Preferences;
  /** Chosen job boards; empty means every source the API offers. */
  sources: string[];
  /** Extra feeds this browser reads on its own. */
  feeds: CustomFeed[];
  feedResults: FeedResult[];
  feedsLoading: boolean;
  theme: Theme;
  onChange: (preferences: Preferences) => void;
  onChangeSources: (sources: string[]) => void;
  onChangeFeeds: (feeds: CustomFeed[]) => void;
  onChangeTheme: (theme: Theme) => void;
}

const MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: "onsite", label: "Presencial" },
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
];

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "entry", label: "Junior" },
  { value: "mid", label: "Semi senior" },
  { value: "senior", label: "Senior" },
];

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: "full_time", label: "Jornada completa" },
  { value: "part_time", label: "Medio horario" },
  { value: "internship", label: "Pasantía" },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/**
 * Sources are stored as an explicit list, with the empty list meaning "all", so
 * a new job board starts included. Turning the last one off goes back to all.
 */
function toggleSource(current: string[], all: string[], value: string): string[] {
  const selected = current.length === 0 ? all : current;
  const next = toggleValue(selected, value);
  return next.length === 0 || next.length === all.length ? [] : next;
}

const labelFrom = (facets: Facet[]) => (value: string) =>
  facets.find((facet) => facet.value === value)?.label;

/** Lives inside the island: what the person is looking for, where the offers
 * come from and how the app looks, all remembered between visits. */
export function PreferencesPanel({
  meta,
  categories,
  departments,
  preferences,
  sources,
  feeds,
  feedResults,
  feedsLoading,
  theme,
  onChange,
  onChangeSources,
  onChangeFeeds,
  onChangeTheme,
}: PreferencesPanelProps) {
  const count = preferenceCount(preferences);
  const hidden = hiddenCount(preferences);
  const allSources = meta?.sources ?? [];

  return (
    <div className="space-y-5 px-4 pt-1 pb-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">
          Orden del listado
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
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
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-onpanel/45">
          Con la primera opción el orden lo deciden tus rubros, tu zona, tu sueldo y lo que cargaste
          en el perfil. Nada se descarta por no coincidir, solo baja de lugar.
        </p>
      </div>

      <StanceChips
        facets={categories}
        hint="Una vez para priorizarlo, otra para ocultarlo, otra para dejarlo neutro."
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
          onChange={(values) => onChange({ ...preferences, categories: values })}
        />
      ) : null}

      <StanceChips
        facets={departments.slice(0, 19)}
        hint="Priorizá dónde querés trabajar y sacá de la lista los departamentos que no te sirven."
        lists={departmentStances(preferences)}
        title="Zona"
        onChange={(lists) => onChange(withDepartmentStances(preferences, lists))}
      />

      {preferences.departments.length > 1 ? (
        <PriorityList
          empty=""
          labelOf={labelFrom(departments)}
          title="Tu orden de zonas"
          values={preferences.departments}
          onChange={(values) => onChange({ ...preferences, departments: values })}
        />
      ) : null}

      <SalaryRange
        value={preferences.salary}
        onChange={(salary) => onChange({ ...preferences, salary })}
      />

      <Group title="Modalidad">
        {MODE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={preferences.modes.includes(option.value)}
            onClick={() =>
              onChange({ ...preferences, modes: toggleValue(preferences.modes, option.value) })
            }
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      <Group title="Nivel">
        {LEVEL_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={preferences.levels.includes(option.value)}
            onClick={() =>
              onChange({ ...preferences, levels: toggleValue(preferences.levels, option.value) })
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

      <Group title="Experiencia">
        <Chip
          active={preferences.noExperience}
          onClick={() => onChange({ ...preferences, noExperience: !preferences.noExperience })}
        >
          Sin experiencia previa
        </Chip>
      </Group>

      <Group title="Apariencia">
        {THEME_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={theme === option.value}
            onClick={() => onChangeTheme(option.value)}
          >
            <option.icon aria-hidden className="size-3.5" />
            {option.label}
          </Chip>
        ))}
      </Group>

      <div className="space-y-3">
        {allSources.length > 0 ? (
          <Group title="Fuentes">
            {allSources.map((source) => (
              <Chip
                key={source}
                active={sources.length === 0 || sources.includes(source)}
                onClick={() => onChangeSources(toggleSource(sources, allSources, source))}
              >
                {SOURCE_LABEL[source] ?? source}
              </Chip>
            ))}
          </Group>
        ) : null}

        <CustomSources
          feeds={feeds}
          loading={feedsLoading}
          results={feedResults}
          onChange={onChangeFeeds}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-onpanel/10 pt-3">
        <p className="text-[11px] leading-snug text-onpanel/50">
          {meta ? (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw aria-hidden className="size-3" />
              {pluralOffers(meta.count)} · actualizado {formatScrapedAt(meta.scraped_at)}
            </span>
          ) : (
            "Las ofertas que coinciden quedan destacadas en la lista."
          )}
        </p>
        {count > 0 || hidden > 0 ? (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-onpanel/60 transition-colors hover:bg-onpanel/10 hover:text-onpanel"
            type="button"
            onClick={() => onChange(EMPTY_PREFERENCES)}
          >
            <RotateCcw aria-hidden className="size-3" />
            Borrar
          </button>
        ) : null}
      </div>
    </div>
  );
}
