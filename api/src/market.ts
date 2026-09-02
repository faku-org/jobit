import { type Role, roleOf } from "./roles.ts";
import type { Job, JobType, Level, WorkMode } from "./types.ts";

const DAY_MS = 86_400_000;

/**
 * Pay is typed by hand into each job board, and it shows: a monthly salary of
 * 1 and one of 11.111.111 are both in the data. Anything outside this window
 * is a typo rather than an offer, and one of them is enough to wreck an
 * average, so they are dropped before anything is computed.
 */
const MIN_CREDIBLE_SALARY = 8_000;
const MAX_CREDIBLE_SALARY = 900_000;

/** A distribution said with quartiles: an average would be dragged by the tail. */
export interface SalarySummary {
  /** How many offers this was computed from; the rest publish no pay. */
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export interface RoleStat {
  slug: string;
  label: string;
  count: number;
  /** The rubro most of these offers sit in, for context. */
  category: string;
  categoryLabel: string;
  noExperience: number;
  salary: SalarySummary | null;
}

export interface CategoryStat {
  value: string;
  label: string;
  count: number;
  noExperience: number;
  salary: SalarySummary | null;
}

export interface DepartmentStat {
  value: string;
  count: number;
  salary: SalarySummary | null;
}

export interface Breakdown {
  value: string;
  count: number;
}

/**
 * What the whole board looks like right now, with no reference to any person:
 * this is the one screen in the app that is about the market and not about you.
 */
export interface MarketReport {
  count: number;
  scraped_at: string;
  /** Offers posted in the last 7 and 30 days, to say how fresh the board is. */
  fresh7: number;
  fresh30: number;
  noExperience: number;
  /** Offers that publish a credible salary, out of the total. */
  withSalary: number;
  salary: SalarySummary | null;
  sources: Breakdown[];
  roles: RoleStat[];
  categories: CategoryStat[];
  departments: DepartmentStat[];
  levels: Breakdown[];
  modes: Breakdown[];
  jobTypes: Breakdown[];
  /** Rubros where the most offers ask for no experience, as a share. */
  entryFriendly: { value: string; label: string; count: number; share: number }[];
}

/** The monthly figure an offer publishes, once it is believable. */
function monthlyPay(job: Job): number | null {
  if (!job.salary) return null;
  /** Ranges are read at their floor: it is the number the person is promised. */
  const value = job.salary.min ?? job.salary.max;
  if (value === null) return null;
  if (value < MIN_CREDIBLE_SALARY || value > MAX_CREDIBLE_SALARY) return null;
  return value;
}

const quantile = (sorted: number[], fraction: number): number =>
  sorted[Math.min(Math.floor(sorted.length * fraction), sorted.length - 1)] ?? 0;

/** Null under a handful of offers: three salaries are an anecdote, not a range. */
export function summarize(values: number[], minimum = 5): SalarySummary | null {
  if (values.length < minimum) return null;
  const sorted = [...values].sort((a, b) => a - b);

  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function tally<T extends string>(jobs: Job[], pick: (job: Job) => T | null): Breakdown[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = pick(job);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/** Groups jobs by a key, keeping the order the groups first appeared in. */
function groupBy<K>(jobs: Job[], key: (job: Job) => K | null): Map<K, Job[]> {
  const groups = new Map<K, Job[]>();
  for (const job of jobs) {
    const value = key(job);
    if (value === null) continue;
    const bucket = groups.get(value);
    if (bucket) bucket.push(job);
    else groups.set(value, [job]);
  }
  return groups;
}

function salaryOf(jobs: Job[]): SalarySummary | null {
  const values: number[] = [];
  for (const job of jobs) {
    const pay = monthlyPay(job);
    if (pay !== null) values.push(pay);
  }
  return summarize(values);
}

const countNoExperience = (jobs: Job[]): number => jobs.filter((job) => job.no_experience).length;

/** The rubro most of a role's offers sit in, so a puesto can be placed. */
function dominantCategory(jobs: Job[]): { value: string; label: string } {
  const counts = new Map<string, { label: string; count: number }>();
  for (const job of jobs) {
    const entry = counts.get(job.category);
    if (entry) entry.count++;
    else counts.set(job.category, { label: job.category_label, count: 1 });
  }
  const best = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  return best ? { value: best[0], label: best[1].label } : { value: "", label: "Sin rubro" };
}

function roleStats(jobs: Job[]): RoleStat[] {
  const groups = groupBy<Role>(jobs, (job) => roleOf(job.title));

  return [...groups.entries()]
    .map(([role, group]) => {
      const category = dominantCategory(group);
      return {
        slug: role.slug,
        label: role.label,
        count: group.length,
        category: category.value,
        categoryLabel: category.label,
        noExperience: countNoExperience(group),
        salary: salaryOf(group),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function categoryStats(jobs: Job[]): CategoryStat[] {
  const groups = groupBy(jobs, (job) => job.category || null);

  return [...groups.entries()]
    .map(([value, group]) => ({
      value,
      label: group[0]?.category_label ?? value,
      count: group.length,
      noExperience: countNoExperience(group),
      salary: salaryOf(group),
    }))
    .sort((a, b) => b.count - a.count);
}

function departmentStats(jobs: Job[]): DepartmentStat[] {
  const groups = groupBy(jobs, (job) => job.department);

  return [...groups.entries()]
    .map(([value, group]) => ({ value, count: group.length, salary: salaryOf(group) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Where somebody with no experience actually has a chance: rubros ranked by
 * the share of their offers that ask for none, not by how many they publish.
 * A rubro with three such offers out of four is more useful to know about than
 * one with forty out of a thousand.
 */
function entryFriendly(categories: CategoryStat[]): MarketReport["entryFriendly"] {
  const MIN_OFFERS = 20;

  return categories
    .filter((entry) => entry.count >= MIN_OFFERS && entry.noExperience > 0)
    .map((entry) => ({
      value: entry.value,
      label: entry.label,
      count: entry.noExperience,
      share: entry.noExperience / entry.count,
    }))
    .sort((a, b) => b.share - a.share);
}

const isNewerThan = (job: Job, days: number, now: number): boolean => {
  const posted = Date.parse(job.date_posted);
  return !Number.isNaN(posted) && now - posted <= days * DAY_MS;
};

export function buildMarketReport(
  jobs: Job[],
  scrapedAt: string,
  now: number = Date.now(),
): MarketReport {
  const categories = categoryStats(jobs);

  return {
    count: jobs.length,
    scraped_at: scrapedAt,
    fresh7: jobs.filter((job) => isNewerThan(job, 7, now)).length,
    fresh30: jobs.filter((job) => isNewerThan(job, 30, now)).length,
    noExperience: countNoExperience(jobs),
    withSalary: jobs.filter((job) => monthlyPay(job) !== null).length,
    salary: salaryOf(jobs),
    sources: tally(jobs, (job) => job.source || null),
    roles: roleStats(jobs),
    categories,
    departments: departmentStats(jobs),
    levels: tally<Level>(jobs, (job) => job.level),
    modes: tally<WorkMode>(jobs, (job) => job.remote ?? "onsite"),
    jobTypes: tally<JobType>(jobs, (job) => job.job_type),
    entryFriendly: entryFriendly(categories),
  };
}
