import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { DynamicIsland } from "./components/DynamicIsland.tsx";
import { FadeUp } from "./components/FadeUp.tsx";
import { FilterBar } from "./components/FilterBar.tsx";
import { JobCard } from "./components/JobCard.tsx";
import { EmptyState, ErrorState, JobListSkeleton } from "./components/States.tsx";
import { useDebounced } from "./hooks/useDebounced.ts";
import { useJobPrefs } from "./hooks/useJobPrefs.ts";
import { useJobs } from "./hooks/useJobs.ts";
import { fetchMeta } from "./lib/api.ts";
import { fadeUpTransition, stagger } from "./lib/motion.ts";
import { pluralOffers } from "./lib/format.ts";
import {
  EMPTY_FILTERS,
  type Filters,
  type Meta,
  hasActiveFilters,
  matchesPreferences,
  preferenceCount,
} from "./lib/types.ts";

function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMeta(controller.signal)
      .then(setMeta)
      .catch(() => setMeta(null));
    return () => controller.abort();
  }, []);

  return meta;
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showSaved, setShowSaved] = useState(false);
  const [hideDismissed, setHideDismissed] = useState(true);
  const [onlySimilar, setOnlySimilar] = useState(false);

  const prefs = useJobPrefs();
  const meta = useMeta();
  const debouncedQuery = useDebounced(filters.q);

  const savedIds = useMemo(() => [...prefs.saved].sort(), [prefs.saved]);
  const activeFilters = { ...filters, q: debouncedQuery };
  const hasPreferences = preferenceCount(prefs.preferences) > 0;
  const similarOnly = onlySimilar && hasPreferences;

  const { jobs, total, status, error, hasMore, loadMore } = useJobs(
    activeFilters,
    showSaved ? (savedIds.length > 0 ? savedIds : ["none"]) : undefined,
    similarOnly ? prefs.preferences : undefined,
  );

  const matches = new Set(
    hasPreferences
      ? jobs.filter((job) => matchesPreferences(job, prefs.preferences)).map((job) => job.id)
      : [],
  );

  const visible = jobs.filter((job) => !hideDismissed || !prefs.dismissed.has(job.id));
  const hiddenCount = jobs.length - visible.length;
  const isDirty = hasActiveFilters(filters) || showSaved || similarOnly;

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setShowSaved(false);
    setOnlySimilar(false);
  };

  return (
    <div className="min-h-svh">
      <DynamicIsland
        categories={meta?.categories ?? []}
        meta={meta}
        preferences={prefs.preferences}
        onChangePreferences={prefs.setPreferences}
      />

      <main className="mx-auto max-w-3xl px-5 pt-24 pb-16 sm:pt-28">
        <FadeUp delay={0.05}>
          <FilterBar
            categories={meta?.categories ?? []}
            departments={meta?.departments ?? []}
            dismissedCount={prefs.dismissed.size}
            filters={filters}
            hasPreferences={hasPreferences}
            hideDismissed={hideDismissed}
            isDirty={isDirty}
            matchCount={similarOnly ? total : matches.size}
            noExperienceCount={meta?.no_experience_count ?? 0}
            onlySimilar={similarOnly}
            savedCount={prefs.saved.size}
            showSaved={showSaved}
            onChange={setFilters}
            onReset={reset}
            onToggleHideDismissed={() => setHideDismissed((current) => !current)}
            onToggleSaved={() => setShowSaved((current) => !current)}
            onToggleSimilar={() => setOnlySimilar((current) => !current)}
          />
        </FadeUp>

        <div className="mt-6 mb-3 flex h-5 items-center px-1 text-xs text-ink/50">
          {status === "ready" || status === "loadingMore" ? (
            <motion.span
              key={`${total}-${visible.length}-${hiddenCount}`}
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              transition={fadeUpTransition}
            >
              {pluralOffers(total)}
              {visible.length < total ? ` · mostrando ${visible.length}` : ""}
              {hiddenCount > 0 ? ` · ${hiddenCount} ocultas` : ""}
            </motion.span>
          ) : null}
        </div>

        {status === "loading" ? <JobListSkeleton /> : null}
        {status === "error" && error ? <ErrorState message={error} /> : null}

        {status !== "loading" && status !== "error" ? (
          visible.length === 0 ? (
            <FadeUp>
              <EmptyState saved={showSaved} similar={similarOnly} onReset={reset} />
            </FadeUp>
          ) : (
            <>
              <div className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {visible.map((job, index) => (
                    <motion.div
                      key={job.id}
                      layout
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      initial={{ opacity: 0, y: 16 }}
                      transition={{
                        ...fadeUpTransition,
                        delay: stagger(index),
                        layout: fadeUpTransition,
                      }}
                    >
                      <JobCard
                        isDismissed={prefs.dismissed.has(job.id)}
                        isMatch={hasPreferences && matches.has(job.id)}
                        isSaved={prefs.saved.has(job.id)}
                        job={job}
                        onToggleDismissed={prefs.toggleDismissed}
                        onToggleSaved={prefs.toggleSaved}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {hasMore ? (
                <div className="mt-6 flex justify-center">
                  <motion.button
                    className="inline-flex items-center gap-2 rounded-xl border border-sky/70 bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist disabled:opacity-60"
                    disabled={status === "loadingMore"}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={loadMore}
                  >
                    {status === "loadingMore" ? (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    ) : null}
                    Ver más ofertas
                  </motion.button>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </main>
    </div>
  );
}
