import type { AnonymousStats } from "./stats.ts";
import type { Filters, Job, JobsResponse, Meta, Preferences } from "./types.ts";

export const PAGE_SIZE = 50;

/** Everything that decides which offers come back, minus the page. */
export interface JobsQueryOptions {
  filters: Filters;
  /** Restricts the result to these ids, used by the saved-jobs view. */
  ids?: string[];
  /** When set, only jobs matching these preferences are asked for. */
  preferences?: Preferences;
  /** Job boards to read from; empty or absent means all of them. */
  sources?: string[];
  /** "closing" asks for the nearest deadline first. */
  sort?: "recent" | "closing";
}

export interface JobsRequest extends JobsQueryOptions {
  offset: number;
}

/** An id no job can have, so the API answers an impossible query with zero rows. */
const NO_MATCH = "none";

/**
 * A dimension carries both an explicit filter and, when "solo similares" is on,
 * the preferred values: the query is their intersection. `null` means the two
 * contradict each other and nothing can match.
 */
function intersect(selected: string, preferred: string[]): string[] | null {
  if (!selected) return preferred;
  if (preferred.length === 0) return [selected];
  return preferred.includes(selected) ? [selected] : null;
}

function buildQuery({ filters, offset, ids, preferences, sources, sort }: JobsRequest): string {
  const params = new URLSearchParams();
  const dimensions: [string, string, string[]][] = [
    ["category", filters.category, preferences?.categories ?? []],
    ["level", filters.level, preferences?.levels ?? []],
    ["remote", filters.mode, preferences?.modes ?? []],
    ["job_type", filters.jobType, preferences?.jobTypes ?? []],
  ];

  let impossible = false;
  for (const [name, selected, preferred] of dimensions) {
    const values = intersect(selected, preferred);
    if (values === null) impossible = true;
    else if (values.length > 0) params.set(name, values.join(","));
  }

  if (impossible) params.set("ids", NO_MATCH);
  else if (ids) params.set("ids", ids.join(","));

  if (sources && sources.length > 0) params.set("source", sources.join(","));
  if (sort) params.set("sort", sort);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.department) params.set("department", filters.department);
  if (filters.noExperience || preferences?.noExperience) params.set("no_experience", "true");
  if (filters.days !== null) params.set("days", String(filters.days));
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  return params.toString();
}

/** True for the rejection a cancelled fetch throws, which is never an error. */
export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  return (await response.json()) as T;
}

export function fetchJobs(request: JobsRequest, signal?: AbortSignal): Promise<JobsResponse> {
  return getJson<JobsResponse>(`/api/jobs?${buildQuery(request)}`, signal);
}

/** One offer by id, used by a shared link and by the embed. */
export function fetchJob(id: string, signal?: AbortSignal): Promise<Job> {
  return getJson<Job>(`/api/jobs/${encodeURIComponent(id)}`, signal);
}

export function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  return getJson<Meta>("/api/meta", signal);
}

/** The one request that carries anything about the person, and it carries no
 * identifier: see stats.ts for the whole payload. */
export async function sendStats(payload: AnonymousStats): Promise<void> {
  const response = await fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
}
