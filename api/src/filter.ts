import type { Facet, Job, JobsQuery, JobsResponse } from "./types.ts";

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

function matches(job: Job, query: JobsQuery, now: number): boolean {
  if (query.ids && !query.ids.has(job.id)) return false;
  if (query.q && !matchesText(job, query.q)) return false;
  if (query.levels && (job.level === null || !query.levels.has(job.level))) return false;
  if (query.workModes && !query.workModes.has(job.remote ?? "onsite")) return false;
  if (query.categories && !query.categories.has(job.category)) return false;
  if (query.department && job.department !== query.department) return false;
  if (query.jobTypes && (job.job_type === null || !query.jobTypes.has(job.job_type))) return false;
  if (query.noExperience && !job.no_experience) return false;
  if (query.days !== undefined && !isNewerThan(job, query.days, now)) return false;
  return true;
}

export function filterJobs(jobs: Job[], query: JobsQuery, now: number = Date.now()): JobsResponse {
  const matched = jobs.filter((job) => matches(job, query, now));

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
