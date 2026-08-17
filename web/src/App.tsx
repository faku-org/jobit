import { Briefcase, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "./components/FilterBar.tsx";
import { JobCard } from "./components/JobCard.tsx";
import { EmptyState, ErrorState, JobListSkeleton } from "./components/States.tsx";
import { useDebounced } from "./hooks/useDebounced.ts";
import { useJobPrefs } from "./hooks/useJobPrefs.ts";
import { useJobs } from "./hooks/useJobs.ts";
import { fetchMeta } from "./lib/api.ts";
import { formatScrapedAt, pluralOffers } from "./lib/format.ts";
import { EMPTY_FILTERS, type Filters, type Meta, hasActiveFilters } from "./lib/types.ts";

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

  const prefs = useJobPrefs();
  const meta = useMeta();
  const debouncedQuery = useDebounced(filters.q);

  const savedIds = useMemo(() => [...prefs.saved].sort(), [prefs.saved]);
  const activeFilters = { ...filters, q: debouncedQuery };
  const { jobs, total, status, error, hasMore, loadMore } = useJobs(
    activeFilters,
    showSaved ? (savedIds.length > 0 ? savedIds : ["none"]) : undefined,
  );

  const visible = hideDismissed ? jobs.filter((job) => !prefs.dismissed.has(job.id)) : jobs;
  const hiddenCount = jobs.length - visible.length;
  const isDirty = hasActiveFilters(filters) || showSaved;

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setShowSaved(false);
  };

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-neutral-900 text-white">
              <Briefcase aria-hidden className="size-4" />
            </span>
            <div>
              <h1 className="text-[15px] leading-tight font-semibold tracking-tight text-neutral-900">
                jobit
              </h1>
              <p className="text-xs text-neutral-500">Ofertas de trabajo en Uruguay</p>
            </div>
          </div>

          {meta ? (
            <div className="hidden text-right text-xs text-neutral-500 sm:block">
              <p className="inline-flex items-center gap-1.5">
                <RefreshCw aria-hidden className="size-3" />
                Actualizado {formatScrapedAt(meta.scraped_at)}
              </p>
              <p className="mt-0.5">
                {pluralOffers(meta.count)} · {meta.sources.join(", ")}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-6 pb-16">
        <FilterBar
          categories={meta?.categories ?? []}
          departments={meta?.departments ?? []}
          dismissedCount={prefs.dismissed.size}
          filters={filters}
          hideDismissed={hideDismissed}
          isDirty={isDirty}
          noExperienceCount={meta?.no_experience_count ?? 0}
          savedCount={prefs.saved.size}
          showSaved={showSaved}
          onChange={setFilters}
          onReset={reset}
          onToggleHideDismissed={() => setHideDismissed((current) => !current)}
          onToggleSaved={() => setShowSaved((current) => !current)}
        />

        <div className="mt-6 mb-3 flex h-5 items-center px-1 text-xs text-neutral-500">
          {status === "ready" || status === "loadingMore" ? (
            <span>
              {pluralOffers(total)}
              {visible.length < total ? ` · mostrando ${visible.length}` : ""}
              {hiddenCount > 0 ? ` · ${hiddenCount} descartadas ocultas` : ""}
            </span>
          ) : null}
        </div>

        {status === "loading" ? <JobListSkeleton /> : null}
        {status === "error" && error ? <ErrorState message={error} /> : null}

        {status !== "loading" && status !== "error" ? (
          visible.length === 0 ? (
            <EmptyState saved={showSaved} onReset={reset} />
          ) : (
            <>
              <div className="space-y-3">
                {visible.map((job) => (
                  <JobCard
                    key={job.id}
                    isDismissed={prefs.dismissed.has(job.id)}
                    isSaved={prefs.saved.has(job.id)}
                    job={job}
                    onToggleDismissed={prefs.toggleDismissed}
                    onToggleSaved={prefs.toggleSaved}
                  />
                ))}
              </div>

              {hasMore ? (
                <div className="mt-6 flex justify-center">
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
                    disabled={status === "loadingMore"}
                    type="button"
                    onClick={loadMore}
                  >
                    {status === "loadingMore" ? (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    ) : null}
                    Ver más ofertas
                  </button>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </main>
    </div>
  );
}
