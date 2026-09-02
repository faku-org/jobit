import { type Ranking, scoreJob } from "./rank.ts";
import type { Facet, Job, JobsQuery, JobsResponse, SalaryRange } from "./types.ts";

const DAY_MS = 86_400_000;

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Searches title, company, location, rubro and description. */
function matchesText(job: Job, needle: string): boolean {
  const haystack = normalize(
    [
      job.title,
      job.company ?? "",
      job.city ?? "",
      job.department ?? "",
      job.category_label,
      job.description,
    ].join(" "),
  );

  return normalize(needle)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function isNewerThan(job: Job, days: number, now: number): boolean {
  const posted = Date.parse(job.date_posted);
  if (Number.isNaN(posted)) return false;
  return now - posted <= days * DAY_MS;
}

/**
 * Four offers out of five publish no pay, so a range that dropped them would
 * empty the board. The person decides with includeUnknown; when they keep them
 * the range only applies to the offers that do say a number.
 */
function matchesSalary(job: Job, range: SalaryRange): boolean {
  const min = job.salary?.min ?? null;
  const max = job.salary?.max ?? null;
  if (min === null && max === null) return range.includeUnknown;

  const low = min ?? max ?? 0;
  const high = max ?? min ?? 0;
  if (range.min !== null && high < range.min) return false;
  if (range.max !== null && low > range.max) return false;
  return true;
}

function matches(job: Job, query: JobsQuery, now: number): boolean {
  if (query.ids && !query.ids.has(job.id)) return false;
  if (query.q && !matchesText(job, query.q)) return false;
  if (query.levels && (job.level === null || !query.levels.has(job.level))) return false;
  if (query.workModes && !query.workModes.has(job.remote ?? "onsite")) return false;
  if (query.categories && !query.categories.has(job.category)) return false;
  if (query.hiddenCategories?.has(job.category)) return false;
  if (query.sources && !query.sources.has(job.source)) return false;
  if (query.departments && (job.department === null || !query.departments.has(job.department))) {
    return false;
  }
  if (job.department !== null && query.hiddenDepartments?.has(job.department)) return false;
  if (query.jobTypes && (job.job_type === null || !query.jobTypes.has(job.job_type))) return false;
  if (query.noExperience && !job.no_experience) return false;
  if (query.salary && !matchesSalary(job, query.salary)) return false;
  if (query.days !== undefined && !isNewerThan(job, query.days, now)) return false;
  return true;
}

/** Nearest deadline first; offers without one go last, newest among them. */
function byClosingDate(a: Job, b: Job): number {
  if (a.closes_at && b.closes_at) return a.closes_at.localeCompare(b.closes_at);
  if (a.closes_at) return -1;
  if (b.closes_at) return 1;
  return b.date_posted.localeCompare(a.date_posted);
}

/**
 * Best fit first. The score is computed once per offer instead of inside the
 * comparator, which would recompute it for every comparison the sort makes.
 */
function byScore(jobs: Job[], ranking: Ranking, now: number): Job[] {
  const scored = jobs.map((job) => ({ job, score: scoreJob(job, ranking, now) }));
  scored.sort((a, b) => b.score - a.score || b.job.date_posted.localeCompare(a.job.date_posted));
  return scored.map((entry) => entry.job);
}

function sortJobs(jobs: Job[], query: JobsQuery, now: number): Job[] {
  if (query.sort === "closing") return [...jobs].sort(byClosingDate);
  if (query.sort === "match" && query.ranking) return byScore(jobs, query.ranking, now);
  return jobs;
}

export function filterJobs(jobs: Job[], query: JobsQuery, now: number = Date.now()): JobsResponse {
  const found = jobs.filter((job) => matches(job, query, now));
  const matched = sortJobs(found, query, now);

  return {
    total: matched.length,
    offset: query.offset,
    limit: query.limit,
    jobs: matched.slice(query.offset, query.offset + query.limit),
  };
}

function countBy(jobs: Job[], pick: (job: Job) => [string, string] | null): Facet[] {
  const counts = new Map<string, Facet>();

  for (const job of jobs) {
    const entry = pick(job);
    if (!entry) continue;
    const [value, label] = entry;
    const facet = counts.get(value);
    if (facet) facet.count++;
    else counts.set(value, { value, label, count: 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export const categoryFacets = (jobs: Job[]): Facet[] =>
  countBy(jobs, (job) => (job.category ? [job.category, job.category_label] : null));

export const departmentFacets = (jobs: Job[]): Facet[] =>
  countBy(jobs, (job) => (job.department ? [job.department, job.department] : null));
