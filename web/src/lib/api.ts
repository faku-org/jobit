import type { MarketReport } from "./market.ts";
import { type Ranking, isEmptyRanking } from "./ranking.ts";
import type { UsageEvent } from "./events.ts";
import type { AnonymousStats } from "./stats.ts";
import type {
  Filters,
  Job,
  JobsResponse,
  Meta,
  Preferences,
  SalaryPreference,
  Sort,
} from "./types.ts";

export const PAGE_SIZE = 50;

/** Everything that decides which offers come back, minus the page. */
export interface JobsQueryOptions {
  filters: Filters;
  /** Restricts the result to these ids, used by the saved-jobs view. */
  ids?: string[];
  /** When set, only jobs matching these preferences are asked for. */
  preferences?: Preferences;
  /** Rubros and departamentos the person hid: the one setting that removes
   * offers whatever else the query says. */
  hiddenCategories?: string[];
  hiddenDepartments?: string[];
  /** Pay range asked for; offers with no published pay follow includeUnknown. */
  salary?: SalaryPreference;
  /** Job boards to read from; empty or absent means all of them. */
  sources?: string[];
  sort?: Sort;
  /** Read only by the "match" sort: what to put first. */
  ranking?: Ranking;
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

/** The ranking travels as one param per dimension; order is the preference. */
function appendRanking(params: URLSearchParams, ranking: Ranking): void {
  const lists: [string, string[]][] = [
    ["rank_category", ranking.categories],
    ["rank_department", ranking.departments],
    ["rank_mode", ranking.modes],
    ["rank_level", ranking.levels],
    ["rank_job_type", ranking.jobTypes],
  ];

  for (const [name, values] of lists) {
    if (values.length > 0) params.set(name, values.join(","));
  }

  if (ranking.salaryTarget !== null) params.set("rank_salary", String(ranking.salaryTarget));
  if (ranking.noExperience) params.set("rank_no_experience", "true");
  if (ranking.education !== null) params.set("rank_education", String(ranking.education));
  if (ranking.experienceYears !== null) {
    params.set("rank_experience", String(ranking.experienceYears));
  }
}

function buildQuery(request: JobsRequest): string {
  const { filters, offset, ids, preferences, salary, sources, sort, ranking } = request;
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
  if (request.hiddenCategories?.length) {
    params.set("hide_category", request.hiddenCategories.join(","));
  }
  if (request.hiddenDepartments?.length) {
    params.set("hide_department", request.hiddenDepartments.join(","));
  }

  if (salary) {
    if (salary.min !== null) params.set("salary_min", String(salary.min));
    if (salary.max !== null) params.set("salary_max", String(salary.max));
    if (!salary.includeUnknown) params.set("salary_unknown", "false");
  }

  if (sort) params.set("sort", sort);
  if (sort === "match" && ranking && !isEmptyRanking(ranking)) appendRanking(params, ranking);

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

/** The whole board summarised; carries nothing about the person asking. */
export function fetchMarket(signal?: AbortSignal): Promise<MarketReport> {
  return getJson<MarketReport>("/api/market", signal);
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

/** Los eventos de uso se mandan al irse de la pestaña, así que `sendBeacon`:
 * es el único envío que el navegador garantiza mientras descarga la página.
 * No devuelve nada porque no hay a quién avisarle si falló. */
export function sendEvents(events: UsageEvent[]): void {
  const body = JSON.stringify({ events });

  if (navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))) return;

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
