import { categoryLabel } from "@jobit/worker/categories";
import { Search, X } from "lucide-react";
import {
  type Currency,
  type ServiceFacet,
  type ServiceFilters as Filters,
  type ServiceSort,
  SERVICE_SORT_LABEL,
  type Rate,
} from "../../lib/services.ts";
import { fieldClass } from "../../lib/styles.ts";
import type { WorkMode } from "../../lib/types.ts";
import { type Option, Select } from "../ui/Select.tsx";

interface ServiceFiltersProps {
  filters: Filters;
  categories: ServiceFacet[];
  departments: ServiceFacet[];
  /** La tasa con la que se pudo comparar precios; null apaga el orden por
   * precio en vez de ordenar por una cuenta que no se puede hacer. */
  rate: Rate | null;
  priceSort: boolean;
  isDirty: boolean;
  onChange: (filters: Filters) => void;
  onReset: () => void;
}

const MODE_OPTIONS: Option[] = [
  { value: "", label: "Cualquier modalidad" },
  { value: "onsite", label: "Presencial" },
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
];

const RATING_OPTIONS: Option[] = [
  { value: "", label: "Cualquier calificación" },
  { value: "3", label: "3 estrellas o más" },
  { value: "4", label: "4 estrellas o más" },
  { value: "4.5", label: "4 y media o más" },
];

const PRICE_OPTIONS: Record<Currency, Option[]> = {
  UYU: [
    { value: "", label: "Cualquier precio" },
    { value: "500", label: "Hasta $ 500" },
    { value: "1000", label: "Hasta $ 1.000" },
    { value: "3000", label: "Hasta $ 3.000" },
    { value: "10000", label: "Hasta $ 10.000" },
  ],
  USD: [
    { value: "", label: "Cualquier precio" },
    { value: "20", label: "Hasta US$ 20" },
    { value: "50", label: "Hasta US$ 50" },
    { value: "100", label: "Hasta US$ 100" },
    { value: "500", label: "Hasta US$ 500" },
  ],
};

const CURRENCY_OPTIONS: Option[] = [
  { value: "UYU", label: "En pesos" },
  { value: "USD", label: "En dólares" },
];

const facetOptions = (
  facets: ServiceFacet[],
  allLabel: string,
  label = (v: string) => v,
): Option[] => [
  { value: "", label: allLabel },
  ...facets.map((facet) => ({
    value: facet.value,
    label: `${label(facet.value)} (${facet.count})`,
  })),
];

/** Los mismos filtros que la sección de ofertas, con lo que un servicio tiene
 * y una oferta no: el precio, la moneda en la que se lee y la calificación. */
export function ServiceFilters({
  filters,
  categories,
  departments,
  rate,
  priceSort,
  isDirty,
  onChange,
  onReset,
}: ServiceFiltersProps) {
  const sortOptions: Option[] = [
    { value: "recent", label: SERVICE_SORT_LABEL.recent },
    { value: "rating", label: SERVICE_SORT_LABEL.rating },
    /** Sin tasa la API no puede comparar pesos con dólares, así que la opción
     * no se ofrece en vez de ofrecerse y no hacer nada. */
    ...(priceSort ? [{ value: "price", label: SERVICE_SORT_LABEL.price }] : []),
  ];

  return (
    <div className="rounded-2xl border border-sky/50 bg-surface p-3 shadow-[var(--shadow-hairline)]">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brand"
        />
        <input
          aria-label="Buscar servicios"
          className={`${fieldClass} py-2.5 pr-10 pl-10 placeholder:text-faint`}
          placeholder="Buscar por oficio, habilidad o palabra de la descripción"
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
        <Select
          label="Rubro"
          options={facetOptions(categories, "Todos los rubros", categoryLabel)}
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
          label="Modalidad"
          options={MODE_OPTIONS}
          value={filters.mode}
          onChange={(value) => onChange({ ...filters, mode: value as WorkMode | "" })}
        />
        <Select
          label="Precio"
          options={PRICE_OPTIONS[filters.currency]}
          value={filters.priceMax === null ? "" : String(filters.priceMax)}
          onChange={(value) => onChange({ ...filters, priceMax: value ? Number(value) : null })}
        />
        <Select
          label="Moneda del tope"
          options={CURRENCY_OPTIONS}
          value={filters.currency}
          onChange={(value) =>
            onChange({ ...filters, currency: value as Currency, priceMax: null })
          }
        />
        <Select
          label="Calificación"
          options={RATING_OPTIONS}
          value={filters.ratingMin === null ? "" : String(filters.ratingMin)}
          onChange={(value) => onChange({ ...filters, ratingMin: value ? Number(value) : null })}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="w-44">
          <Select
            label="Ordenar"
            options={sortOptions}
            value={filters.sort}
            onChange={(value) => onChange({ ...filters, sort: value as ServiceSort })}
          />
        </div>

        {filters.currency === "USD" && rate ? (
          <p className="text-xs text-muted">
            Los precios en dólares se comparan a ${rate.usd_uyu} por dólar. Es aproximado y solo
            para ordenar: cada servicio cobra en la moneda que publicó.
          </p>
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
