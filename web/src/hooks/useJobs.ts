import { useEffect, useState } from "react";
import { PAGE_SIZE, fetchJobs } from "../lib/api.ts";
import type { Filters, Job } from "../lib/types.ts";

type Status = "loading" | "loadingMore" | "ready" | "error";

interface JobsState {
  jobs: Job[];
  total: number;
  status: Status;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

/**
 * Fetches a page of jobs whenever the filters change, and appends pages on
 * loadMore. A filter change always restarts from offset 0.
 */
export function useJobs(filters: Filters, ids?: string[]): JobsState {
  const key = JSON.stringify([filters, ids]);
  const [request, setRequest] = useState({ key, filters, ids, offset: 0 });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  if (request.key !== key) {
    setRequest({ key, filters, ids, offset: 0 });
  }

  useEffect(() => {
    const controller = new AbortController();
    const isFirstPage = request.offset === 0;

    setStatus(isFirstPage ? "loading" : "loadingMore");
    setError(null);

    fetchJobs(
      { filters: request.filters, offset: request.offset, ids: request.ids },
      controller.signal,
    )
      .then((response) => {
        setTotal(response.total);
        setJobs((previous) => (isFirstPage ? response.jobs : [...previous, ...response.jobs]));
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (isAbort(cause)) return;
        setError(cause instanceof Error ? cause.message : "Error desconocido");
        setStatus("error");
      });

    return () => controller.abort();
  }, [request]);

  return {
    jobs,
    total,
    status,
    error,
    hasMore: jobs.length < total,
    loadMore: () => setRequest((current) => ({ ...current, offset: current.offset + PAGE_SIZE })),
  };
}
