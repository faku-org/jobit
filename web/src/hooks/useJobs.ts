import { startTransition, useEffect, useState } from "react";
import { type JobsQueryOptions, PAGE_SIZE, fetchJobs, isAbortError } from "../lib/api.ts";
import type { Job } from "../lib/types.ts";

type Status = "loading" | "loadingMore" | "ready" | "error";

interface JobsState {
  jobs: Job[];
  total: number;
  status: Status;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Fetches a page of jobs whenever the query changes, and appends pages on
 * loadMore. A query change always restarts from offset 0.
 *
 * `enabled` holds the request without unmounting anything: while the intro
 * owns the screen there is nobody to show a list to, and the answers it is
 * collecting are half of the query it would be asking with.
 */
export function useJobs(options: JobsQueryOptions, enabled = true): JobsState {
  const key = JSON.stringify(options);
  const [request, setRequest] = useState({ key, options, offset: 0 });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  if (request.key !== key) {
    setRequest({ key, options, offset: 0 });
  }

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const isFirstPage = request.offset === 0;

    setStatus(isFirstPage ? "loading" : "loadingMore");
    setError(null);

    fetchJobs({ ...request.options, offset: request.offset }, controller.signal)
      .then((response) => {
        /** A page is fifty cards: as a transition React can split the render
         * across frames instead of blocking the tab while it mounts them. */
        startTransition(() => {
          setTotal(response.total);
          setJobs((previous) => (isFirstPage ? response.jobs : [...previous, ...response.jobs]));
          setStatus("ready");
        });
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(cause instanceof Error ? cause.message : "Error desconocido");
        setStatus("error");
      });

    return () => controller.abort();
  }, [request, enabled]);

  return {
    jobs,
    total,
    status,
    error,
    hasMore: jobs.length < total,
    loadMore: () => setRequest((current) => ({ ...current, offset: current.offset + PAGE_SIZE })),
  };
}
