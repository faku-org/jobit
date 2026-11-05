import { useEffect, useRef, useState } from "react";
import { MAX_PAGE, type JobsQueryOptions, fetchJobs, isAbortError } from "../lib/api.ts";
import { EMPTY_FILTERS, type Job } from "../lib/types.ts";
import { useJobs } from "./useJobs.ts";

type Status = "loading" | "loadingMore" | "ready" | "error";

export interface NewsState {
  /** El tablero reciente, ordenado por encaje. */
  jobs: Job[];
  /** Las ofertas que la persona sigue (guardadas o postuladas). */
  followed: Job[];
  status: Status;
}

/**
 * Los datos de Novedades: la lista reciente del tablero, ordenada por encaje, y
 * aparte las ofertas que la persona sigue, que es lo único que puede tener un
 * cierre próximo. La lista usa la misma caché y la misma versión de tablero que
 * el resto, así que abrir la pestaña no vuelve a empezar.
 *
 * Nada de esto viaja del lado del servidor por persona: el encaje se calcula
 * acá, con las preferencias que viven en el navegador.
 */
export function useNews(
  options: JobsQueryOptions,
  followedIds: string[],
  enabled: boolean,
): NewsState {
  const board = useJobs(options, enabled);
  const [followed, setFollowed] = useState<Job[]>([]);
  /** Los ids cambian de identidad en cada render; la lista la dispara el texto
   * que los junta, y el efecto lee los ids actuales del ref. */
  const idsRef = useRef(followedIds);
  idsRef.current = followedIds;
  const key = followedIds.join(",");

  useEffect(() => {
    if (!enabled || key === "") {
      setFollowed([]);
      return;
    }

    const controller = new AbortController();
    const ids = idsRef.current;
    fetchJobs(
      {
        filters: EMPTY_FILTERS,
        ids,
        sort: "closing",
        offset: 0,
        limit: Math.min(ids.length, MAX_PAGE),
      },
      controller.signal,
    )
      .then((response) => setFollowed(response.jobs))
      .catch((cause: unknown) => {
        if (!isAbortError(cause)) setFollowed([]);
      });

    return () => controller.abort();
  }, [enabled, key]);

  return { jobs: board.jobs, followed, status: board.status };
}
