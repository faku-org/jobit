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
import { Market } from "./components/Market.tsx";
import { Onboarding } from "./components/Onboarding.tsx";
import { EmptyState, ErrorState, JobListSkeleton } from "./components/States.tsx";
import { Tracking } from "./components/Tracking.tsx";
import type { TagActions } from "./components/JobChips.tsx";
import { ViewTabs } from "./components/ViewTabs.tsx";
import { useDebounced } from "./hooks/useDebounced.ts";
import { useJobPrefs } from "./hooks/useJobPrefs.ts";
import { useJobLink } from "./hooks/useJobLink.ts";
import { useJobs } from "./hooks/useJobs.ts";
import { useViewLink } from "./hooks/useViewLink.ts";
import { useCustomFeeds } from "./hooks/useCustomFeeds.ts";
import { useMarket } from "./hooks/useMarket.ts";
import { useStats } from "./hooks/useStats.ts";
import { useSearchTracking, useTracking } from "./hooks/useTracking.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { fetchJob, fetchMeta, isAbortError } from "./lib/api.ts";
import { fadeUpTransition } from "./lib/motion.ts";
import { pluralOffers } from "./lib/format.ts";
import { isOnboarded } from "./lib/profile.ts";
import { isEmptyRanking, toRanking } from "./lib/ranking.ts";
import { readViewState } from "./lib/url.ts";
import {
  EMPTY_FILTERS,
  STATE_SOURCE,
  type Filters,
  type Application,
  type Job,
  type Meta,
  type Sort,
  type Tag,
  type View,
  applyTagToFilters,
  groupByCategory,
  hasActiveFilters,
  hasSalaryPreference,
  hiddenCount,
  matchesFilters,
  matchesPreferences,
  preferenceCount,
  togglePreferredTag,
} from "./lib/types.ts";

/**
 * One line under the tabs saying what each list is for. The shortlist and the
 * follow-up looked interchangeable without it, and they are not: one is before
 * applying and the other is after.
 */
const VIEW_HINT: Record<View, string> = {
  all: "",
  state: "Llamados públicos de Uruguay Concursa, ordenados por el que cierra primero.",
  saved: "Las que marcaste para pensar. Cuando te postulás pasan solas a Seguimiento.",
  tracking: "Las que ya mandaste, con el estado de cada una. Tocá una para ver la oferta.",
  market: "",
};

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
  /** Read once on mount, so a shared link paints its own section on the first
   * render instead of the board and then a jump. */
  const [linked] = useState(readViewState);
  const [filters, setFilters] = useState<Filters>(linked.filters);
  const [view, setView] = useState<View>(linked.view);
  /** A deliberate detour to look at what was discarded, not a display option:
   * discarding means gone, and this is the way back. */
  const [reviewingDiscarded, setReviewingDiscarded] = useState(false);
  const [onlySimilar, setOnlySimilar] = useState(false);
  /** The saved view filters by rubro on the client, over its own chips. */
  const [savedCategory, setSavedCategory] = useState("");
  const [openJob, setOpenJob] = useState<Job | null>(null);
  /** Opening a tracked application means fetching the offer behind its
   * snapshot; it may be gone, and then the row says so instead. */
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [goneIds, setGoneIds] = useState<Set<string>>(new Set());

  const prefs = useJobPrefs();
  const meta = useMeta();
  /**
   * Read from storage on the first render, so a first visit paints the intro
   * and never the list underneath it. Until it is done the app is not mounted
   * at all: the list used to load behind the questions and have them dropped
   * on top, which read as an interruption rather than a welcome.
   */
  const showIntro = !isOnboarded(prefs.profile);
  const debouncedQuery = useDebounced(filters.q);
  useTheme(prefs.theme);
  useJobLink(openJob, setOpenJob);
  useViewLink(
    view,
    filters,
    (state) => {
      setView(state.view);
      setFilters(state.filters);
      setSavedCategory("");
      setReviewingDiscarded(false);
    },
    !showIntro,
  );

  const savedIds = [...prefs.saved].sort();
  const discardedIds = [...prefs.dismissed].sort();
  const isSavedView = view === "saved";
  const isStateView = view === "state";
  const isMarketView = view === "market";
  /**
   * The pile is reviewed in one place only. Discarding works anywhere, but the
   * pile is global: offering it inside Estado would show a count of offers most
   * of which that view cannot list, which is the leak this replaced.
   */
  const canReviewDiscarded = view === "all";
  const reviewing = reviewingDiscarded && canReviewDiscarded && discardedIds.length > 0;
  const market = useMarket(isMarketView);
  const customFeeds = useCustomFeeds(prefs.feeds);
  const hasPreferences = preferenceCount(prefs.preferences) > 0;
  const similarOnly = onlySimilar && hasPreferences;

  /**
   * Everything the person told the app, profile included, turned into what
   * should come first. The API sorts on it, so the order holds over the whole
   * board and not just over the page that happens to be loaded; changing the
   * profile changes this object, which changes the query, which refetches.
   */
  const ranking = toRanking(prefs.preferences, prefs.profile);
  const canRank = !isEmptyRanking(ranking);
  /** The saved view is the person's own order, and the Estado view is a race
   * against a deadline: neither is the place to second-guess with a score. */
  const sort: Sort | undefined = isStateView
    ? "closing"
    : !isSavedView && prefs.preferences.rankByFit && canRank
      ? "match"
      : undefined;

  const { jobs, total, status, error, hasMore, loadMore } = useJobs(
    {
      filters: {
        ...filters,
        q: debouncedQuery,
        category: isSavedView ? "" : filters.category,
      },
      ids: isSavedView
        ? savedIds.length > 0
          ? savedIds
          : ["none"]
        : reviewing
          ? discardedIds
          : undefined,
      preferences: similarOnly ? prefs.preferences : undefined,
      hiddenCategories: isSavedView ? undefined : prefs.preferences.hiddenCategories,
      hiddenDepartments: isSavedView ? undefined : prefs.preferences.hiddenDepartments,
      salary:
        !isSavedView && hasSalaryPreference(prefs.preferences.salary)
          ? prefs.preferences.salary
          : undefined,
      /** Reviewing shows everything discarded, whichever board it came from. */
      sources: isStateView ? [STATE_SOURCE] : reviewing ? undefined : prefs.sources,
      sort,
      ranking: sort === "match" ? ranking : undefined,
    },
    !showIntro,
  );

  const matches = new Set(
    hasPreferences
      ? jobs.flatMap((job) => (matchesPreferences(job, prefs.preferences) ? [job.id] : []))
      : [],
  );

  /**
   * Offers from feeds the person added. The API never sees them, so the same
   * filters are applied here, and they stay in their own group rather than
   * being mixed into a ranking computed over a board they are not part of.
   */
  const feedJobs =
    isSavedView || isStateView || isMarketView || reviewing
      ? []
      : customFeeds.jobs.filter(
          (job) =>
            matchesFilters(job, { ...filters, q: debouncedQuery }) &&
            !prefs.preferences.hiddenCategories.includes(job.category) &&
            (job.department === null ||
              !prefs.preferences.hiddenDepartments.includes(job.department)) &&
            !prefs.dismissed.has(job.id),
        );

  const kept = reviewing ? jobs : jobs.filter((job) => !prefs.dismissed.has(job.id));
  const savedGroups = isSavedView ? groupByCategory(kept) : [];
  const visible =
    isSavedView && savedCategory ? kept.filter((job) => job.category === savedCategory) : kept;
  const discardedHere = jobs.length - kept.length;
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
    interviews: prefs.applications.filter((entry) => entry.status === "interview").length,
    closed: prefs.applications.filter((entry) => entry.status === "closed").length,
    sources: prefs.sources,
  };

  useStats(prefs.profile, usage, prefs.statsSentAt, prefs.markStatsSent);
  useTracking(prefs.profile.shareStats);
  useSearchTracking(filters, total, status === "ready");

  const openTracked = (application: Application) => {
    setOpeningId(application.id);
    fetchJob(application.id)
      .then((job) => setOpenJob(job))
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setGoneIds((current) => new Set(current).add(application.id));
      })
      .finally(() => setOpeningId(null));
  };

  const changeView = (next: View) => {
    setView(next);
    setSavedCategory("");
    setReviewingDiscarded(false);
  };

  if (showIntro) {
    return (
      <Onboarding
        categories={meta?.categories ?? []}
        departments={meta?.departments ?? []}
        preferences={prefs.preferences}
        profile={prefs.profile}
        onFinish={prefs.completeOnboarding}
      />
    );
  }

  /* Deliberately not animated as a whole. A transform here would make this
     div the containing block for every fixed child, which put the job sheet
     thousands of pixels down the page on a phone and shifted the island; and
     an entrance that never finished would leave the whole app invisible. The
     intro fades itself out onto this same background, and each section below
     brings its own entrance. */
  return (
    <div className="min-h-svh">
      <DynamicIsland
        categories={meta?.categories ?? []}
        counts={{
          saved: prefs.saved.size,
          applications: prefs.applications.length,
          dismissed: prefs.dismissed.size,
          preferences: preferenceCount(prefs.preferences) + hiddenCount(prefs.preferences),
        }}
        departments={meta?.departments ?? []}
        feedResults={customFeeds.results}
        feeds={prefs.feeds}
        feedsLoading={customFeeds.loading}
        meta={meta}
        preferences={prefs.preferences}
        profile={prefs.profile}
        sources={prefs.sources}
        theme={prefs.theme}
        usage={usage}
        onChangePreferences={prefs.setPreferences}
        onChangeProfile={prefs.setProfile}
        onChangeSources={prefs.setSources}
        onChangeFeeds={prefs.setFeeds}
        onChangeTheme={prefs.setTheme}
        onEraseEverything={prefs.eraseEverything}
        onImportCv={(nextProfile, nextPreferences) => {
          prefs.setProfile(nextProfile);
          prefs.setPreferences(nextPreferences);
        }}
        onResetPreferences={prefs.resetPreferences}
        onRestartOnboarding={prefs.restartOnboarding}
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

        {VIEW_HINT[view] ? (
          <FadeUp delay={0.03}>
            <p className="mt-3 px-1 text-xs leading-relaxed text-ink/50">{VIEW_HINT[view]}</p>
          </FadeUp>
        ) : null}

        {view === "tracking" ? (
          <div className="mt-6">
            <FadeUp delay={0.05}>
              <Tracking
                applications={prefs.applications}
                goneIds={goneIds}
                openingId={openingId}
                onOpen={openTracked}
                onRemove={prefs.removeApplication}
                onSetStatus={prefs.setApplicationStatus}
              />
            </FadeUp>
          </div>
        ) : isMarketView ? (
          <div className="mt-6">
            {market.status === "error" ? (
              <ErrorState message="No se pudieron cargar las estadísticas del mercado." />
            ) : market.report ? (
              <Market
                report={market.report}
                onExploreCategory={(category) => {
                  setView("all");
                  setFilters({ ...EMPTY_FILTERS, category });
                }}
                onSearch={(q) => {
                  setView("all");
                  setFilters({ ...EMPTY_FILTERS, q });
                }}
              />
            ) : (
              <JobListSkeleton />
            )}
          </div>
        ) : (
          <>
            <div className="mt-3">
              <FadeUp delay={0.05}>
                <FilterBar
                  categories={meta?.categories ?? []}
                  departments={meta?.departments ?? []}
                  canReviewDiscarded={canReviewDiscarded}
                  discardedCount={prefs.dismissed.size}
                  filters={filters}
                  hasPreferences={hasPreferences}
                  isDirty={isDirty}
                  matchCount={similarOnly ? total : matches.size}
                  noExperienceCount={meta?.no_experience_count ?? 0}
                  onlySimilar={similarOnly}
                  reviewingDiscarded={reviewing}
                  showCategory={!isSavedView}
                  onChange={setFilters}
                  onReset={reset}
                  onToggleReviewDiscarded={() => setReviewingDiscarded((current) => !current)}
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
                  key={`${total}-${visible.length}-${discardedHere}-${sort}`}
                  animate={{ opacity: 1 }}
                  initial={{ opacity: 0 }}
                  transition={fadeUpTransition}
                >
                  {pluralOffers(total)}
                  {visible.length < total ? ` · mostrando ${visible.length}` : ""}
                  {discardedHere > 0 ? ` · ${discardedHere} descartadas` : ""}
                  {sort === "match" ? " · ordenadas para vos" : ""}
                  {sort === "closing" ? " · las que cierran primero" : ""}
                </motion.span>
              ) : null}
            </div>

            {reviewing ? (
              <FadeUp>
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-sky/60 bg-mist px-3.5 py-2.5">
                  <p className="text-xs leading-relaxed text-ink/70">
                    {prefs.dismissed.size === 1
                      ? "Estás viendo la oferta que descartaste."
                      : `Estás viendo las ${prefs.dismissed.size} ofertas que descartaste.`}{" "}
                    Tocá el ícono de deshacer en cualquiera para devolverla a la lista.
                  </p>
                  <button
                    className="ml-auto shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-ink/60 transition-colors hover:bg-surface hover:text-ink"
                    type="button"
                    onClick={() => setReviewingDiscarded(false)}
                  >
                    Volver
                  </button>
                </div>
              </FadeUp>
            ) : null}

            {feedJobs.length > 0 ? (
              <FadeUp>
                <section className="mb-6">
                  <h2 className="mb-3 flex items-baseline gap-2 px-1">
                    <span className="text-sm font-semibold tracking-tight text-ink">
                      De tus fuentes
                    </span>
                    <span className="text-xs text-ink/50 tabular-nums">{feedJobs.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {feedJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        isApplied={prefs.appliedIds.has(job.id)}
                        isDismissed={prefs.dismissed.has(job.id)}
                        isMatch={hasPreferences && matchesPreferences(job, prefs.preferences)}
                        isSaved={prefs.saved.has(job.id)}
                        job={job}
                        tagActions={tagActions}
                        onApplied={prefs.addApplication}
                        onOpen={setOpenJob}
                        onToggleDismissed={prefs.toggleDismissed}
                        onToggleSaved={prefs.toggleSaved}
                      />
                    ))}
                  </div>
                </section>
              </FadeUp>
            ) : null}

            {status === "loading" ? <JobListSkeleton /> : null}
            {status === "error" && error ? <ErrorState message={error} /> : null}

            {status !== "loading" && status !== "error" ? (
              visible.length === 0 && feedJobs.length === 0 ? (
                <FadeUp>
                  <EmptyState
                    canReset={isDirty}
                    hidden={hiddenCount(prefs.preferences)}
                    similar={similarOnly}
                    view={view}
                    onReset={reset}
                  />
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
