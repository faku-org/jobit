import { Monitor, Moon, RefreshCw, RotateCcw, Sun } from "lucide-react";
import { SOURCE_LABEL, formatScrapedAt, pluralOffers } from "../lib/format.ts";
import type { Facet, JobType, Level, Meta, Preferences, Theme, WorkMode } from "../lib/types.ts";
import { EMPTY_PREFERENCES, preferenceCount, toggleValue } from "../lib/types.ts";
import { PanelChip as Chip, PanelGroup as Group } from "./PanelControls.tsx";

interface PreferencesPanelProps {
  meta: Meta | null;
  categories: Facet[];
  preferences: Preferences;
  /** Chosen job boards; empty means every source the API offers. */
  sources: string[];
  theme: Theme;
  onChange: (preferences: Preferences) => void;
  onChangeSources: (sources: string[]) => void;
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

/** Lives inside the island: what the person is looking for, where the offers
 * come from and how the app looks, all remembered between visits. */
export function PreferencesPanel({
  meta,
  categories,
  preferences,
  sources,
  theme,
  onChange,
  onChangeSources,
  onChangeTheme,
}: PreferencesPanelProps) {
  const count = preferenceCount(preferences);
  const allSources = meta?.sources ?? [];

  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
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

      <Group title="Experiencia">
        <Chip
          active={preferences.noExperience}
          onClick={() => onChange({ ...preferences, noExperience: !preferences.noExperience })}
        >
          Sin experiencia previa
        </Chip>
      </Group>

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

      {categories.length > 0 ? (
        <Group title="Rubros">
          {categories.map((facet) => (
            <Chip
              key={facet.value}
              active={preferences.categories.includes(facet.value)}
              onClick={() =>
                onChange({
                  ...preferences,
                  categories: toggleValue(preferences.categories, facet.value),
                })
              }
            >
              {facet.label}
            </Chip>
          ))}
        </Group>
      ) : null}

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
        {count > 0 ? (
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
