import type { Job } from "./types.ts";

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Same role, same employer, same place: one card, several apply links. */
const fingerprint = (job: Job): string =>
  [
    normalize(job.title),
    normalize(job.company ?? ""),
    normalize(job.city ?? job.department ?? ""),
  ].join("|");

/**
 * Collapses reposts and cross-postings. The offer with the richest description
 * wins; the rest survive as duplicate apply links on the winner.
 */
export function dedupe(jobs: Job[]): Job[] {
  const groups = new Map<string, Job[]>();

  for (const job of jobs) {
    const key = fingerprint(job);
    const group = groups.get(key);
    if (group) group.push(job);
    else groups.set(key, [job]);
  }

  const merged: Job[] = [];

  for (const group of groups.values()) {
    const [primary, ...rest] = [...group].sort(
      (a, b) =>
        b.description.length - a.description.length || b.date_posted.localeCompare(a.date_posted),
    );
    if (!primary) continue;

    merged.push({
      ...primary,
      duplicates: rest.map((job) => ({ source: job.source, apply_url: job.apply_url })),
    });
  }

  return merged;
}
