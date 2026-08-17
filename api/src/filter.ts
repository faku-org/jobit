import type { Job, JobsQuery, JobsResponse } from "./types.ts";

const DAY_MS = 86_400_000;

function matchesText(job: Job, needle: string): boolean {
  const haystack = `${job.title} ${job.company} ${job.location}`.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function isNewerThan(job: Job, days: number, now: number): boolean {
  const posted = Date.parse(job.date_posted);
  if (Number.isNaN(posted)) return false;
  return now - posted <= days * DAY_MS;
}

export function filterJobs(jobs: Job[], query: JobsQuery, now: number = Date.now()): JobsResponse {
  const matched = jobs.filter((job) => {
    if (query.q && !matchesText(job, query.q)) return false;
    if (query.level && job.level !== query.level) return false;
    if (query.remote && job.remote !== query.remote) return false;
    if (query.days !== undefined && !isNewerThan(job, query.days, now)) {
      return false;
    }
    return true;
  });

  return {
    total: matched.length,
    offset: query.offset,
    limit: query.limit,
    jobs: matched.slice(query.offset, query.offset + query.limit),
  };
}
