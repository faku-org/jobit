import { Bookmark, ChevronDown, EyeOff, Search, Sparkles, X } from "lucide-react";
import type { Facet, Filters, JobType, Level, Remote } from "../lib/types.ts";

interface Option {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: Filters;
  categories: Facet[];
  departments: Facet[];
  noExperienceCount: number;
  savedCount: number;
  dismissedCount: number;
  showSaved: boolean;
  hideDismissed: boolean;
  isDirty: boolean;
  onChange: (filters: Filters) => void;
  onToggleSaved: () => void;
  onToggleHideDismissed: () => void;
  onReset: () => void;
}

const LEVEL_OPTIONS: Option[] = [
  { value: "", label: "Cualquier nivel" },
  { value: "entry", label: "Junior" },
  { value: "mid", label: "Semi senior" },
  { value: "senior", label: "Senior" },
];

const REMOTE_OPTIONS: Option[] = [
  { value: "", label: "Cualquier modalidad" },
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
];

const JOB_TYPE_OPTIONS: Option[] = [
  { value: "", label: "Cualquier jornada" },
  { value: "full_time", label: "Jornada completa" },
  { value: "part_time", label: "Medio horario" },
  { value: "internship", label: "Pasantía" },
];

const DAYS_OPTIONS: Option[] = [
  { value: "", label: "Cualquier fecha" },
  { value: "3", label: "Últimos 3 días" },
  { value: "7", label: "Últimos 7 días" },
  { value: "14", label: "Últimos 14 días" },
  { value: "30", label: "Últimos 30 días" },
];

const facetOptions = (facets: Facet[], allLabel: string): Option[] => [
  { value: "", label: allLabel },
  ...facets.map((facet) => ({ value: facet.value, label: `${facet.label} (${facet.count})` })),
];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        className="w-full appearance-none truncate rounded-xl border border-neutral-200 bg-white py-2.5 pr-9 pl-3.5 text-sm text-neutral-800 transition-colors outline-none hover:border-neutral-300 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-900/5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400"
      />
    </div>
  );
}

function Toggle({
  active,
  icon: Icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: typeof Bookmark;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon aria-hidden className="size-3.5" />
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  categories,
  departments,
  noExperienceCount,
  savedCount,
  dismissedCount,
  showSaved,
  hideDismissed,
  isDirty,
  onChange,
  onToggleSaved,
  onToggleHideDismissed,
  onReset,
}: FilterBarProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          aria-label="Buscar ofertas"
          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pr-10 pl-10 text-sm text-neutral-900 transition-colors outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-900/5"
          placeholder="Buscar por puesto, empresa, ciudad o palabra de la descripción"
          type="text"
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
        {filters.q ? (
          <button
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors hover:text-neutral-700"
            type="button"
            onClick={() => onChange({ ...filters, q: "" })}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Select
          label="Rubro"
          options={facetOptions(categories, "Todos los rubros")}
          value={filters.category}
          onChange={(value) => onChange({ ...filters, category: value })}
        />
        <Select
          label="Departamento"
          options={facetOptions(departments, "Todo el país")}
          value={filters.department}
          onChange={(value) => onChange({ ...filters, department: value })}
        />
        <Select
          label="Jornada"
          options={JOB_TYPE_OPTIONS}
          value={filters.jobType}
          onChange={(value) => onChange({ ...filters, jobType: value as JobType | "" })}
        />
        <Select
          label="Nivel"
          options={LEVEL_OPTIONS}
          value={filters.level}
          onChange={(value) => onChange({ ...filters, level: value as Level | "" })}
        />
        <Select
          label="Modalidad"
          options={REMOTE_OPTIONS}
          value={filters.remote}
          onChange={(value) => onChange({ ...filters, remote: value as Remote | "" })}
        />
        <Select
          label="Publicadas"
          options={DAYS_OPTIONS}
          value={filters.days === null ? "" : String(filters.days)}
          onChange={(value) => onChange({ ...filters, days: value ? Number(value) : null })}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Toggle
          active={filters.noExperience}
          icon={Sparkles}
          onClick={() => onChange({ ...filters, noExperience: !filters.noExperience })}
        >
          Sin experiencia{noExperienceCount > 0 ? ` (${noExperienceCount})` : ""}
        </Toggle>

        <Toggle active={showSaved} icon={Bookmark} onClick={onToggleSaved}>
          Guardadas{savedCount > 0 ? ` (${savedCount})` : ""}
        </Toggle>

        {dismissedCount > 0 ? (
          <Toggle active={!hideDismissed} icon={EyeOff} onClick={onToggleHideDismissed}>
            {hideDismissed ? `Ver descartadas (${dismissedCount})` : "Ocultar descartadas"}
          </Toggle>
        ) : null}

        {isDirty ? (
          <button
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
            type="button"
            onClick={onReset}
          >
            <X aria-hidden className="size-3.5" />
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
