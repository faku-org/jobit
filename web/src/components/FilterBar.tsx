import { Bookmark, EyeOff, Search, Sparkles, Target, X } from "lucide-react";
import { motion } from "motion/react";
import { fieldClass } from "../lib/styles.ts";
import type { Facet, Filters, JobType, Level, WorkMode } from "../lib/types.ts";
import { type Option, Select } from "./Select.tsx";

interface FilterBarProps {
  filters: Filters;
  categories: Facet[];
  departments: Facet[];
  noExperienceCount: number;
  /** How many offers were discarded, and whether this view can review them.
   * Discarding is meaningless where nothing can be discarded, so the control
   * is absent there instead of present and inert. */
  discardedCount: number;
  canReviewDiscarded: boolean;
  reviewingDiscarded: boolean;
  matchCount: number;
  hasPreferences: boolean;
  onlySimilar: boolean;
  isDirty: boolean;
  /** The saved view filters by rubro with its own chips, so it hides this one. */
  showCategory: boolean;
  onChange: (filters: Filters) => void;
  onToggleReviewDiscarded: () => void;
  onToggleSimilar: () => void;
  onReset: () => void;
}

const LEVEL_OPTIONS: Option[] = [
  { value: "", label: "Cualquier nivel" },
  { value: "entry", label: "Junior" },
  { value: "mid", label: "Semi senior" },
  { value: "senior", label: "Senior" },
];

const MODE_OPTIONS: Option[] = [
  { value: "", label: "Cualquier modalidad" },
  { value: "onsite", label: "Presencial" },
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
    <motion.button
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-panel bg-panel text-onpanel"
          : "border-sky/60 bg-surface text-muted hover:border-brand hover:text-ink"
      }`}
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      <Icon aria-hidden className="size-3.5" />
      {children}
    </motion.button>
  );
}

export function FilterBar({
  filters,
  categories,
  departments,
  noExperienceCount,
  discardedCount,
  canReviewDiscarded,
  reviewingDiscarded,
  matchCount,
  hasPreferences,
  onlySimilar,
  isDirty,
  showCategory,
  onChange,
  onToggleReviewDiscarded,
  onToggleSimilar,
  onReset,
}: FilterBarProps) {
  return (
    <div className="rounded-2xl border border-sky/50 bg-surface p-3 shadow-[var(--shadow-hairline)]">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brand"
        />
        <input
          aria-label="Buscar ofertas"
          className={`${fieldClass} py-2.5 pr-10 pl-10 placeholder:text-faint`}
          placeholder="Buscar por puesto, empresa, ciudad o palabra de la descripción"
          type="text"
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
        {filters.q ? (
          <button
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-faint transition-colors hover:text-ink"
            type="button"
            onClick={() => onChange({ ...filters, q: "" })}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {showCategory ? (
          <Select
            label="Rubro"
            options={facetOptions(categories, "Todos los rubros")}
            value={filters.category}
            onChange={(value) => onChange({ ...filters, category: value })}
          />
        ) : null}
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
          options={MODE_OPTIONS}
          value={filters.mode}
          onChange={(value) => onChange({ ...filters, mode: value as WorkMode | "" })}
        />
        <Select
          label="Publicadas"
          options={DAYS_OPTIONS}
          value={filters.days === null ? "" : String(filters.days)}
          onChange={(value) => onChange({ ...filters, days: value ? Number(value) : null })}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasPreferences ? (
          <Toggle active={onlySimilar} icon={Target} onClick={onToggleSimilar}>
            Solo similares{matchCount > 0 ? ` (${matchCount})` : ""}
          </Toggle>
        ) : null}

        <Toggle
          active={filters.noExperience}
          icon={Sparkles}
          onClick={() => onChange({ ...filters, noExperience: !filters.noExperience })}
        >
          Sin experiencia{noExperienceCount > 0 ? ` (${noExperienceCount})` : ""}
        </Toggle>

        {canReviewDiscarded && discardedCount > 0 ? (
          <Toggle active={reviewingDiscarded} icon={EyeOff} onClick={onToggleReviewDiscarded}>
            {reviewingDiscarded
              ? "Volver a las ofertas"
              : `Ver las que descartaste (${discardedCount})`}
          </Toggle>
        ) : null}

        {isDirty ? (
          <button
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
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
