import type { Job, JobsResponse, Meta } from "./types.ts";

/** El dominio de producción. Se puede apuntar a un self-host con JOBIT_API_URL. */
export const DEFAULT_BASE_URL = "https://jobs.wefaber.net";

/**
 * Un fallo hablándole a la API. Lleva el status cuando la respuesta llegó y
 * null cuando ni eso: la herramienta del agente tiene que poder decir qué
 * pasó, no solo que falló.
 */
export class JobitApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "JobitApiError";
    this.status = status;
  }
}

export interface ApiOptions {
  /** Base de la API; por defecto JOBIT_API_URL o producción. */
  baseUrl?: string;
  /** Para los tests: un `fetch` de mentira. */
  fetchImpl?: typeof fetch;
  /** Un agente no puede quedarse colgado esperando; por defecto 15 segundos. */
  timeoutMs?: number;
}

/** Los mismos nombres de parámetro que `GET /api/jobs`. */
export interface SearchParams {
  q?: string;
  category?: string;
  department?: string;
  level?: "entry" | "mid" | "senior";
  remote?: "onsite" | "remote" | "hybrid";
  job_type?: "full_time" | "part_time" | "internship";
  no_experience?: boolean;
  days?: number;
  source?: string;
  sort?: "recent" | "closing";
  limit?: number;
  offset?: number;
}

export interface Api {
  searchJobs(params: SearchParams): Promise<JobsResponse>;
  getJob(id: string): Promise<Job>;
  market(): Promise<unknown>;
  meta(): Promise<Meta>;
}

export function createApi(options: ApiOptions = {}): Api {
  const base = (options.baseUrl ?? process.env.JOBIT_API_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function get<T>(path: string, params?: object): Promise<T> {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await doFetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new JobitApiError(`No se pudo contactar la API de JobIt en ${base}: ${detail}`);
    }

    if (!response.ok) {
      let detail = "";
      try {
        const body: unknown = await response.json();
        if (body && typeof body === "object" && "error" in body) detail = String(body.error);
      } catch {
        /** El cuerpo no era JSON: el status ya alcanza. */
      }
      throw new JobitApiError(
        `La API de JobIt respondió ${response.status}${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  return {
    searchJobs: (params) => get<JobsResponse>("/api/jobs", params),
    getJob: (id) => get<Job>(`/api/jobs/${encodeURIComponent(id)}`),
    market: () => get<unknown>("/api/market"),
    meta: () => get<Meta>("/api/meta"),
  };
}
