import { Bookmark, ChartColumn, ClipboardList, Landmark, LayoutList } from "lucide-react";
import { motion } from "motion/react";
import { islandTransition } from "../lib/motion.ts";
import type { View } from "../lib/types.ts";

interface ViewTabsProps {
  view: View;
  savedCount: number;
  trackedCount: number;
  onChange: (view: View) => void;
}

const TABS: { value: View; label: string; icon: typeof LayoutList }[] = [
  { value: "all", label: "Ofertas", icon: LayoutList },
  { value: "state", label: "Estado", icon: Landmark },
  { value: "saved", label: "Guardadas", icon: Bookmark },
  { value: "tracking", label: "Seguimiento", icon: ClipboardList },
  { value: "market", label: "Mercado", icon: ChartColumn },
];

/** Switches the main area between the feed, the public-sector calls, the
 * shortlist, the follow-up and the country-wide numbers. */
export function ViewTabs({ view, savedCount, trackedCount, onChange }: ViewTabsProps) {
  const badge = (value: View): number =>
    value === "saved" ? savedCount : value === "tracking" ? trackedCount : 0;

  return (
    <div
      className="flex flex-wrap gap-1 rounded-2xl border border-sky/50 bg-surface p-1 shadow-[var(--shadow-hairline)] sm:flex-nowrap"
      role="tablist"
    >
      {TABS.map((tab) => {
        const active = view === tab.value;
        const count = badge(tab.value);

        return (
          <button
            key={tab.value}
            aria-selected={active}
            className={`relative flex min-h-10 grow basis-auto items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors sm:min-h-0 sm:basis-0 sm:py-2 sm:text-sm ${
              active ? "text-onpanel" : "text-ink/60 hover:text-ink"
            }`}
            role="tab"
            type="button"
            onClick={() => onChange(tab.value)}
          >
            {active ? (
              <motion.span
                className="absolute inset-0 rounded-xl bg-panel"
                layoutId="view-tab"
                transition={islandTransition}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              <tab.icon aria-hidden className="size-3.5" />
              {tab.label}
              {count > 0 ? <span className="tabular-nums">({count})</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
