import type { Filters, JobsResponse, Meta, Preferences } from "./types.ts";

export const PAGE_SIZE = 50;

export interface JobsRequest {
  filters: Filters;
  offset: number;
  /** Restricts the result to these ids, used by the saved-jobs view. */
  ids?: string[];
  /** When set, only jobs matching these preferences are asked for. */
  preferences?: Preferences;
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

function buildQuery({ filters, offset, ids, preferences }: JobsRequest): string {
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

  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.department) params.set("department", filters.department);
  if (filters.noExperience) params.set("no_experience", "true");
  if (filters.days !== null) params.set("days", String(filters.days));
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  return params.toString();
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  return (await response.json()) as T;
}

export function fetchJobs(request: JobsRequest, signal?: AbortSignal): Promise<JobsResponse> {
  return getJson<JobsResponse>(`/api/jobs?${buildQuery(request)}`, signal);
}

export function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  return getJson<Meta>("/api/meta", signal);
}
