import { Bookmark, ChartColumn, ClipboardList, Landmark, LayoutList, Wrench } from "lucide-react";
import { motion } from "motion/react";
import { islandTransition } from "../../lib/motion.ts";
import type { View } from "../../lib/types.ts";

interface ViewTabsProps {
  view: View;
  savedCount: number;
  trackedCount: number;
  onChange: (view: View) => void;
  /** Apuntar una pestaña ya es intención de abrirla: se avisa para que lo que
   * hay detrás empiece a venir antes del clic. */
  onPrefetch: (view: View) => void;
}

const TABS: { value: View; label: string; icon: typeof LayoutList }[] = [
  { value: "all", label: "Ofertas", icon: LayoutList },
  { value: "state", label: "Estado", icon: Landmark },
  { value: "services", label: "Servicios", icon: Wrench },
  { value: "saved", label: "Guardadas", icon: Bookmark },
  { value: "tracking", label: "Seguimiento", icon: ClipboardList },
  { value: "market", label: "Mercado", icon: ChartColumn },
];

/** Switches the main area between the feed, the public-sector calls, the
 * services, the shortlist, the follow-up and the country-wide numbers. */
export function ViewTabs({ view, savedCount, trackedCount, onChange, onPrefetch }: ViewTabsProps) {
  const badge = (value: View): number =>
    value === "saved" ? savedCount : value === "tracking" ? trackedCount : 0;

  return (
    /* Seis pestañas no entran en una fila de teléfono. En vez de dejarlas
       envolver a lo que caiga —una fila de cuatro y otra de dos, que cambia de
       forma según el largo de las palabras— se reagrupan en dos filas parejas
       de tres, y recién en pantalla ancha vuelven a una sola fila. */
    <div
      className="grid grid-cols-3 gap-1 rounded-2xl border border-sky/50 bg-surface p-1 shadow-[var(--shadow-hairline)] md:flex"
      role="tablist"
    >
      {TABS.map((tab) => {
        const active = view === tab.value;
        const count = badge(tab.value);

        return (
          <button
            key={tab.value}
            aria-selected={active}
            className={`relative flex min-h-10 items-center justify-center gap-1 rounded-xl px-0.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors md:min-h-0 md:grow md:basis-auto md:gap-1.5 md:px-2.5 md:py-2 md:text-[13px] ${
              active ? "text-onpanel" : "text-muted hover:text-ink"
            }`}
            role="tab"
            type="button"
            onClick={() => onChange(tab.value)}
            onFocus={() => onPrefetch(tab.value)}
            onMouseEnter={() => onPrefetch(tab.value)}
            onPointerDown={() => onPrefetch(tab.value)}
          >
            {active ? (
              <motion.span
                className="absolute inset-0 rounded-xl bg-panel"
                layoutId="view-tab"
                transition={islandTransition}
              />
            ) : null}
            {/* En el teléfono la celda da para el nombre o para el ícono, y el
                nombre es el que dice adónde lleva. El contador se va abajo
                cuando no entra al lado, que es mejor que cortar la palabra. */}
            <span className="relative inline-flex flex-wrap items-center justify-center gap-x-1 md:gap-x-1.5">
              <tab.icon aria-hidden className="hidden size-3.5 shrink-0 md:block" />
              {tab.label}
              {count > 0 ? <span className="tabular-nums">({count})</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
