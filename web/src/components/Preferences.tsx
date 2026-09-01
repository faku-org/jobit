import { Check, RotateCcw } from "lucide-react";
import type { Facet, JobType, Level, Preferences, WorkMode } from "../lib/types.ts";
import { EMPTY_PREFERENCES, preferenceCount } from "../lib/types.ts";

interface PreferencesPanelProps {
  categories: Facet[];
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
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

const toggle = <T extends string>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-sky text-ink" : "bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
      }`}
      type="button"
      onClick={onClick}
    >
      {active ? <Check aria-hidden className="size-3" /> : null}
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Lives inside the island: what the person is looking for, remembered between
 * visits and used to highlight or narrow the list. */
export function PreferencesPanel({ categories, preferences, onChange }: PreferencesPanelProps) {
  const count = preferenceCount(preferences);

  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
      <Group title="Modalidad">
        {MODE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={preferences.modes.includes(option.value)}
            onClick={() =>
              onChange({ ...preferences, modes: toggle(preferences.modes, option.value) })
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
              onChange({ ...preferences, levels: toggle(preferences.levels, option.value) })
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
              onChange({ ...preferences, jobTypes: toggle(preferences.jobTypes, option.value) })
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
                  categories: toggle(preferences.categories, facet.value),
                })
              }
            >
              {facet.label}
            </Chip>
          ))}
        </Group>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <p className="text-[11px] leading-snug text-white/50">
          Las ofertas que coinciden quedan destacadas en la lista.
        </p>
        {count > 0 ? (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
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
