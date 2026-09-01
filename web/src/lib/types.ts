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
}

export const EMPTY_PREFERENCES: Preferences = {
  modes: [],
  categories: [],
  levels: [],
  jobTypes: [],
};

export const workMode = (job: Job): WorkMode => job.remote ?? "onsite";

export const preferenceCount = (preferences: Preferences): number =>
  preferences.modes.length +
  preferences.categories.length +
  preferences.levels.length +
  preferences.jobTypes.length;

export function matchesPreferences(job: Job, preferences: Preferences): boolean {
  const { modes, categories, levels, jobTypes } = preferences;
  if (modes.length > 0 && !modes.includes(workMode(job))) return false;
  if (categories.length > 0 && !categories.includes(job.category)) return false;
  if (levels.length > 0 && (job.level === null || !levels.includes(job.level))) return false;
  if (jobTypes.length > 0 && (job.job_type === null || !jobTypes.includes(job.job_type))) {
    return false;
  }
  return true;
}
