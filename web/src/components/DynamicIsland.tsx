import { Briefcase, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useScrolledPast } from "../hooks/useScrolledPast.ts";
import { formatScrapedAt, pluralOffers } from "../lib/format.ts";
import { islandTransition } from "../lib/motion.ts";
import { type Facet, type Meta, type Preferences, preferenceCount } from "../lib/types.ts";
import { PreferencesPanel } from "./Preferences.tsx";

interface DynamicIslandProps {
  meta: Meta | null;
  categories: Facet[];
  preferences: Preferences;
  onChangePreferences: (preferences: Preferences) => void;
}

/**
 * A floating header, detached from the top of the page: wide at rest, shrunk
 * to a pill once the list scrolls, and expanded into a sheet that holds the
 * preferences.
 */
export function DynamicIsland({
  meta,
  categories,
  preferences,
  onChangePreferences,
}: DynamicIslandProps) {
  const [open, setOpen] = useState(false);
  const condensed = useScrolledPast(24);

  const count = preferenceCount(preferences);
  const compact = condensed && !open;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4">
      <motion.header
        layout
        className={`pointer-events-auto w-full overflow-hidden rounded-[26px] bg-ink text-white shadow-[0_8px_30px_rgba(13,71,161,0.28)] ring-1 ring-white/10 backdrop-blur-xl ${
          compact ? "max-w-md" : "max-w-3xl"
        }`}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={islandTransition}
      >
        <motion.div layout className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <motion.span
            layout
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white"
          >
            <Briefcase aria-hidden className="size-4" />
          </motion.span>

          <motion.div layout className="min-w-0 flex-1">
            <h1 className="text-[15px] leading-tight font-semibold tracking-tight">jobit</h1>
            <AnimatePresence initial={false} mode="popLayout">
              {compact ? (
                meta ? (
                  <motion.p
                    key="compact"
                    animate={{ opacity: 1 }}
                    className="truncate text-[11px] text-white/60"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                  >
                    {pluralOffers(meta.count)}
                  </motion.p>
                ) : null
              ) : (
                <motion.p
                  key="full"
                  animate={{ opacity: 1 }}
                  className="truncate text-xs text-white/60"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                >
                  Ofertas de trabajo en Uruguay
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence initial={false}>
            {!compact && meta ? (
              <motion.div
                key="meta"
                animate={{ opacity: 1, width: "auto" }}
                className="hidden overflow-hidden text-right text-[11px] whitespace-nowrap text-white/60 sm:block"
                exit={{ opacity: 0, width: 0 }}
                initial={{ opacity: 0, width: 0 }}
                transition={islandTransition}
              >
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw aria-hidden className="size-3" />
                  Actualizado {formatScrapedAt(meta.scraped_at)}
                </span>
                <p className="mt-0.5">
                  {pluralOffers(meta.count)} · {meta.sources.join(", ")}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.button
            layout
            aria-expanded={open}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              open || count > 0
                ? "bg-sky text-ink hover:bg-white"
                : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            }`}
            type="button"
            onClick={() => setOpen((current) => !current)}
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Preferencias</span>
            {count > 0 ? <span>({count})</span> : null}
          </motion.button>
        </motion.div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="panel"
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={islandTransition}
            >
              <PreferencesPanel
                categories={categories}
                preferences={preferences}
                onChange={onChangePreferences}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.header>
    </div>
  );
}
