export type Level = "entry" | "mid" | "senior";
export type Remote = "remote" | "hybrid";
export type JobType = "full_time" | "part_time" | "internship";

/** Remote is null on offers that are worked from the employer's site. */
export type WorkMode = Remote | "onsite";

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface DuplicateRef {
  source: string;
  apply_url: string;
}

export interface Job {
  id: string;
  source: string;
  source_id: string;
  title: string;
  company: string | null;
  department: string | null;
  city: string | null;
  category: string;
  category_label: string;
  date_posted: string;
  level: Level | null;
  remote: Remote | null;
  job_type: JobType | null;
  salary: Salary | null;
  experience_years_min: number | null;
  no_experience: boolean;
  education_level: string | null;
  schedule: string | null;
  vacancies: number | null;
  /** Deadline to apply, only published by the public-sector source. */
  closes_at: string | null;
  description: string;
  requirements: string | null;
  apply_url: string;
  duplicates: DuplicateRef[];
}

export interface JobsResponse {
  total: number;
  offset: number;
  limit: number;
  jobs: Job[];
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface Meta {
  count: number;
  scraped_at: string;
  sources: string[];
  categories: Facet[];
  departments: Facet[];
  no_experience_count: number;
}

/** Colour scheme; "system" follows the OS setting. */
export type Theme = "light" | "dark" | "system";

export type ApplicationStatus = "applied" | "interview" | "closed";

/**
 * An offer the person told us they actually applied to. The job fields are a
 * snapshot: the follow-up list has to survive the offer leaving the feed.
 */
export interface Application {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  title: string;
  company: string | null;
  category: string;
  categoryLabel: string;
  source: string;
  applyUrl: string;
}

export const toApplication = (job: Job, at: string = new Date().toISOString()): Application => ({
  id: job.id,
  status: "applied",
  appliedAt: at,
  title: job.title,
  company: job.company,
  category: job.category,
  categoryLabel: job.category_label,
  source: job.source,
  applyUrl: job.apply_url,
});

/**
 * Applications the person already sent that say something about this offer:
 * same employer first, same rubro second.
 */
export interface RelatedApplications {
  company: Application[];
  category: Application[];
}

const sameCompany = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

export function relatedApplications(job: Job, applications: Application[]): RelatedApplications {
  const others = applications.filter((entry) => entry.id !== job.id);
  const company = others.filter((entry) => sameCompany(entry.company, job.company));
  const inCompany = new Set(company.map((entry) => entry.id));

  return {
    company,
    category: others.filter((entry) => entry.category === job.category && !inCompany.has(entry.id)),
  };
}

/** The lists the main area can show. */
export type View = "all" | "saved" | "tracking" | "state";

/** The job board that publishes the public-sector calls. */
export const STATE_SOURCE = "uruguayconcursa";

export interface Filters {
  q: string;
  category: string;
  department: string;
  level: Level | "";
  mode: WorkMode | "";
  jobType: JobType | "";
  noExperience: boolean;
  days: number | null;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  category: "",
  department: "",
  level: "",
  mode: "",
  jobType: "",
  noExperience: false,
  days: null,
};

export const hasActiveFilters = (filters: Filters): boolean =>
  filters.q !== "" ||
  filters.category !== "" ||
  filters.department !== "" ||
  filters.level !== "" ||
  filters.mode !== "" ||
  filters.jobType !== "" ||
  filters.noExperience ||
  filters.days !== null;

/**
 * What the person is looking for, as opposed to the one-off filters above.
 * An empty dimension means "no preference"; a job is similar when it satisfies
 * every dimension that was set.
 */
export interface Preferences {
  modes: WorkMode[];
  categories: string[];
  levels: Level[];
  jobTypes: JobType[];
  noExperience: boolean;
}

export const EMPTY_PREFERENCES: Preferences = {
  modes: [],
  categories: [],
  levels: [],
  jobTypes: [],
  noExperience: false,
};

/** Adds or removes a value from one of the preference lists. */
export const toggleValue = <T extends string>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export const workMode = (job: Job): WorkMode => job.remote ?? "onsite";

/** Offers sharing a rubro, used by the saved view. */
export interface CategoryGroup {
  value: string;
  label: string;
  jobs: Job[];
}

/** Groups a list by rubro, biggest group first. */
export function groupByCategory(jobs: Job[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();

  for (const job of jobs) {
    const group = groups.get(job.category);
    if (group) group.jobs.push(job);
    else groups.set(job.category, { value: job.category, label: job.category_label, jobs: [job] });
  }

  return [...groups.values()].sort(
    (a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label),
  );
}

export const preferenceCount = (preferences: Preferences): number =>
  preferences.modes.length +
  preferences.categories.length +
  preferences.levels.length +
  preferences.jobTypes.length +
  (preferences.noExperience ? 1 : 0);

export function matchesPreferences(job: Job, preferences: Preferences): boolean {
  const { modes, categories, levels, jobTypes } = preferences;
  if (modes.length > 0 && !modes.includes(workMode(job))) return false;
  if (categories.length > 0 && !categories.includes(job.category)) return false;
  if (levels.length > 0 && (job.level === null || !levels.includes(job.level))) return false;
  if (jobTypes.length > 0 && (job.job_type === null || !jobTypes.includes(job.job_type))) {
    return false;
  }
  if (preferences.noExperience && !job.no_experience) return false;
  return true;
}

/** The dimensions a job chip can act on. */
export type TagDimension = "category" | "level" | "mode" | "jobType" | "noExperience";

/** A chip on a job card, tied to the filter and preference dimension behind it. */
export interface Tag {
  dimension: TagDimension;
  /** Unused by the boolean dimensions. */
  value: string;
  label: string;
}

export function isPreferredTag(tag: Tag, preferences: Preferences): boolean {
  switch (tag.dimension) {
    case "category":
      return preferences.categories.includes(tag.value);
    case "level":
      return preferences.levels.includes(tag.value as Level);
    case "mode":
      return preferences.modes.includes(tag.value as WorkMode);
    case "jobType":
      return preferences.jobTypes.includes(tag.value as JobType);
    case "noExperience":
      return preferences.noExperience;
  }
}

/** Starring a chip: the tag joins the preferences and starts pulling matching
 * offers forward. */
export function togglePreferredTag(preferences: Preferences, tag: Tag): Preferences {
  switch (tag.dimension) {
    case "category":
      return { ...preferences, categories: toggleValue(preferences.categories, tag.value) };
    case "level":
      return { ...preferences, levels: toggleValue(preferences.levels, tag.value as Level) };
    case "mode":
      return { ...preferences, modes: toggleValue(preferences.modes, tag.value as WorkMode) };
    case "jobType":
      return { ...preferences, jobTypes: toggleValue(preferences.jobTypes, tag.value as JobType) };
    case "noExperience":
      return { ...preferences, noExperience: !preferences.noExperience };
  }
}

/** Clicking through a chip: the list narrows to offers carrying that tag. */
export function applyTagToFilters(filters: Filters, tag: Tag): Filters {
  switch (tag.dimension) {
    case "category":
      return { ...filters, category: tag.value };
    case "level":
      return { ...filters, level: tag.value as Level };
    case "mode":
      return { ...filters, mode: tag.value as WorkMode };
    case "jobType":
      return { ...filters, jobType: tag.value as JobType };
    case "noExperience":
      return { ...filters, noExperience: true };
  }
}
