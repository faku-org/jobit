import { startTransition, useEffect, useState } from "react";
import {
  type JobsQueryOptions,
  MAX_PAGE,
  PAGE_SIZE,
  fetchJobs,
  isAbortError,
  jobsQueryKey,
} from "../lib/api.ts";
import { isStale, readJobs, writeJobs } from "../lib/jobsCache.ts";
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

/** Lo que falta pedir. `append` distingue traer más de volver a traer. */
interface Pending {
  offset: number;
  limit: number;
  append: boolean;
}

interface State {
  key: string;
  options: JobsQueryOptions;
  jobs: Job[];
  total: number;
  pending: Pending | null;
  status: Status;
  error: string | null;
}

/**
 * El arranque de una consulta: lo que ya se había traído si está guardado, y
 * el pedido que haga falta. Una consulta ya vista se pinta entera de una y sin
 * esqueleto; si quedó vieja se revalida atrás, pidiendo la misma profundidad
 * que tenía para no perder las páginas que se habían cargado.
 */
function begin(key: string, options: JobsQueryOptions): State {
  const hit = readJobs(key);

  if (hit === undefined) {
    return {
      key,
      options,
      jobs: [],
      total: 0,
      pending: { offset: 0, limit: PAGE_SIZE, append: false },
      status: "loading",
      error: null,
    };
  }

  return {
    key,
    options,
    jobs: hit.jobs,
    total: hit.total,
    pending: isStale(hit)
      ? { offset: 0, limit: Math.min(hit.jobs.length, MAX_PAGE), append: false }
      : null,
    status: "ready",
    error: null,
  };
}

/**
 * Fetches a page of jobs whenever the query changes, and appends pages on
 * loadMore. Lo ya traído se guarda por consulta, así que volver a una pestaña
 * es instantáneo en vez de empezar de cero.
 *
 * `enabled` holds the request without unmounting anything: while the intro
 * owns the screen there is nobody to show a list to, and the answers it is
 * collecting are half of the query it would be asking with.
 */
export function useJobs(options: JobsQueryOptions, enabled = true): JobsState {
  const key = jobsQueryKey(options);
  const [state, setState] = useState<State>(() => begin(key, options));

  if (state.key !== key) {
    setState(begin(key, options));
  }

  const { key: asked, options: sent, pending } = state;

  useEffect(() => {
    if (!enabled || pending === null) return;

    const controller = new AbortController();

    fetchJobs({ ...sent, offset: pending.offset, limit: pending.limit }, controller.signal)
      .then((response) => {
        /** A page is fifty cards: as a transition React can split the render
         * across frames instead of blocking the tab while it mounts them. */
        startTransition(() => {
          setState((current) => {
            if (current.key !== asked) return current;
            const jobs = pending.append ? [...current.jobs, ...response.jobs] : response.jobs;
            writeJobs(asked, jobs, response.total);
            return {
              ...current,
              jobs,
              total: response.total,
              pending: null,
              status: "ready",
              error: null,
            };
          });
        });
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setState((current) => {
          if (current.key !== asked) return current;
          /** Una revalidación que falla no borra lo que se está mirando: la
           * lista guardada sigue siendo verdad hasta que se pruebe lo otro. */
          if (current.jobs.length > 0) return { ...current, pending: null, status: "ready" };
          return {
            ...current,
            pending: null,
            status: "error",
            error: cause instanceof Error ? cause.message : "Error desconocido",
          };
        });
      });

    return () => controller.abort();
  }, [asked, sent, pending, enabled]);

  return {
    jobs: state.jobs,
    total: state.total,
    status: state.status,
    error: state.error,
    hasMore: state.jobs.length < state.total,
    loadMore: () =>
      setState((current) =>
        current.pending !== null
          ? current
          : {
              ...current,
              status: "loadingMore",
              pending: { offset: current.jobs.length, limit: PAGE_SIZE, append: true },
            },
      ),
  };
}
