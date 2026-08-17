import type { Filters, JobsResponse, Meta } from "./types.ts";

export const PAGE_SIZE = 50;

export interface JobsRequest {
  filters: Filters;
  offset: number;
  /** Restricts the result to these ids, used by the saved-jobs view. */
  ids?: string[];
}

function buildQuery({ filters, offset, ids }: JobsRequest): string {
  const params = new URLSearchParams();
  if (ids) params.set("ids", ids.join(","));
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.department) params.set("department", filters.department);
  if (filters.level) params.set("level", filters.level);
  if (filters.remote) params.set("remote", filters.remote);
  if (filters.jobType) params.set("job_type", filters.jobType);
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
