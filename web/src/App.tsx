import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { CategoryChips } from "./components/CategoryChips.tsx";
import { DynamicIsland } from "./components/DynamicIsland.tsx";
import { FadeUp } from "./components/FadeUp.tsx";
import { FilterBar } from "./components/FilterBar.tsx";
import { JobCard } from "./components/JobCard.tsx";
import { JobList } from "./components/JobList.tsx";
import { JobModal } from "./components/JobModal.tsx";
import { EmptyState, ErrorState, JobListSkeleton } from "./components/States.tsx";
import { Tracking } from "./components/Tracking.tsx";
import type { TagActions } from "./components/JobChips.tsx";
import { ViewTabs } from "./components/ViewTabs.tsx";
import { useDebounced } from "./hooks/useDebounced.ts";
import { useJobPrefs } from "./hooks/useJobPrefs.ts";
import { useJobLink } from "./hooks/useJobLink.ts";
import { useJobs } from "./hooks/useJobs.ts";
import { useStats } from "./hooks/useStats.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { fetchMeta } from "./lib/api.ts";
import { fadeUpTransition } from "./lib/motion.ts";
import { pluralOffers } from "./lib/format.ts";
import {
  EMPTY_FILTERS,
  STATE_SOURCE,
  type Filters,
  type Job,
  type Meta,
  type Tag,
  type View,
  applyTagToFilters,
  groupByCategory,
  hasActiveFilters,
  matchesPreferences,
  preferenceCount,
  togglePreferredTag,
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
  const [view, setView] = useState<View>("all");
  const [hideDismissed, setHideDismissed] = useState(true);
  const [onlySimilar, setOnlySimilar] = useState(false);
  /** The saved view filters by rubro on the client, over its own chips. */
  const [savedCategory, setSavedCategory] = useState("");
  const [openJob, setOpenJob] = useState<Job | null>(null);

  const prefs = useJobPrefs();
  const meta = useMeta();
  const debouncedQuery = useDebounced(filters.q);
  useTheme(prefs.theme);
  useJobLink(openJob, setOpenJob);

  const savedIds = [...prefs.saved].sort();
  const isSavedView = view === "saved";
  const isStateView = view === "state";
  const hasPreferences = preferenceCount(prefs.preferences) > 0;
  const similarOnly = onlySimilar && hasPreferences;

  const { jobs, total, status, error, hasMore, loadMore } = useJobs({
    filters: {
      ...filters,
      q: debouncedQuery,
      category: isSavedView ? "" : filters.category,
    },
    ids: isSavedView ? (savedIds.length > 0 ? savedIds : ["none"]) : undefined,
    preferences: similarOnly ? prefs.preferences : undefined,
    sources: isStateView ? [STATE_SOURCE] : prefs.sources,
    sort: isStateView ? "closing" : undefined,
  });

  const matches = new Set(
    hasPreferences
      ? jobs.flatMap((job) => (matchesPreferences(job, prefs.preferences) ? [job.id] : []))
      : [],
  );

  const kept = jobs.filter((job) => !hideDismissed || !prefs.dismissed.has(job.id));
  const savedGroups = isSavedView ? groupByCategory(kept) : [];
  const visible =
    isSavedView && savedCategory ? kept.filter((job) => job.category === savedCategory) : kept;
  const hiddenCount = jobs.length - kept.length;
  const isDirty = hasActiveFilters(filters) || similarOnly || savedCategory !== "";

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setOnlySimilar(false);
    setSavedCategory("");
  };

  /** Chips act on the list they are in: the rubro of a saved offer narrows the
   * saved view, everything else goes through the filters. */
  const tagActions: TagActions = {
    preferences: prefs.preferences,
    profile: prefs.profile,
    onFilter: (tag: Tag) => {
      if (isSavedView && tag.dimension === "category") return setSavedCategory(tag.value);
      setFilters((current) => applyTagToFilters(current, tag));
    },
    onTogglePreferred: (tag: Tag) =>
      prefs.setPreferences(togglePreferredTag(prefs.preferences, tag)),
  };

  const usage = {
    saved: prefs.saved.size,
    applications: prefs.applications.length,
    sources: prefs.sources,
  };

  useStats(prefs.profile, usage, prefs.statsSentAt, prefs.markStatsSent);

  const changeView = (next: View) => {
    setView(next);
    setSavedCategory("");
  };

  return (
    <div className="min-h-svh">
      <DynamicIsland
        categories={meta?.categories ?? []}
        meta={meta}
        preferences={prefs.preferences}
        profile={prefs.profile}
        sources={prefs.sources}
        theme={prefs.theme}
        usage={usage}
        onChangePreferences={prefs.setPreferences}
        onChangeProfile={prefs.setProfile}
        onChangeSources={prefs.setSources}
        onChangeTheme={prefs.setTheme}
      />

      <main className="mx-auto max-w-3xl px-5 pt-24 pb-16 sm:pt-28">
        <FadeUp>
          <ViewTabs
            savedCount={prefs.saved.size}
            trackedCount={prefs.applications.length}
            view={view}
            onChange={changeView}
          />
        </FadeUp>

        {view === "tracking" ? (
          <div className="mt-6">
            <FadeUp delay={0.05}>
              <Tracking
                applications={prefs.applications}
                onRemove={prefs.removeApplication}
                onSetStatus={prefs.setApplicationStatus}
              />
            </FadeUp>
          </div>
        ) : (
          <>
            <div className="mt-3">
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
                  showCategory={!isSavedView}
                  onChange={setFilters}
                  onReset={reset}
                  onToggleHideDismissed={() => setHideDismissed((current) => !current)}
                  onToggleSimilar={() => setOnlySimilar((current) => !current)}
                />
              </FadeUp>
            </div>

            {isSavedView && savedGroups.length > 1 ? (
              <div className="mt-3">
                <CategoryChips
                  groups={savedGroups}
                  selected={savedCategory}
                  onSelect={setSavedCategory}
                />
              </div>
            ) : null}

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
                  <EmptyState saved={isSavedView} similar={similarOnly} onReset={reset} />
                </FadeUp>
              ) : (
                <>
                  <JobList
                    byCategory={isSavedView && savedCategory === ""}
                    jobs={visible}
                    renderJob={(job) => (
                      <JobCard
                        isApplied={prefs.appliedIds.has(job.id)}
                        isDismissed={prefs.dismissed.has(job.id)}
                        isMatch={hasPreferences && matches.has(job.id)}
                        isSaved={prefs.saved.has(job.id)}
                        job={job}
                        tagActions={tagActions}
                        onApplied={prefs.addApplication}
                        onOpen={setOpenJob}
                        onToggleDismissed={prefs.toggleDismissed}
                        onToggleSaved={prefs.toggleSaved}
                      />
                    )}
                  />

                  {hasMore ? (
                    <div className="mt-6 flex justify-center">
                      <motion.button
                        className="inline-flex items-center gap-2 rounded-xl border border-sky/70 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist disabled:opacity-60"
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
          </>
        )}
      </main>

      {openJob ? (
        <JobModal
          key={openJob.id}
          applications={prefs.applications}
          isApplied={prefs.appliedIds.has(openJob.id)}
          isDismissed={prefs.dismissed.has(openJob.id)}
          isMatch={hasPreferences && matchesPreferences(openJob, prefs.preferences)}
          isSaved={prefs.saved.has(openJob.id)}
          job={openJob}
          tagActions={tagActions}
          onApplied={prefs.addApplication}
          onClose={() => setOpenJob(null)}
          onToggleDismissed={prefs.toggleDismissed}
          onToggleSaved={prefs.toggleSaved}
        />
      ) : null}
    </div>
  );
}
