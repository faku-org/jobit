import type { Ranking } from "./rank.ts";

export type Level = "entry" | "mid" | "senior";
export type Remote = "remote" | "hybrid";
export type JobType = "full_time" | "part_time" | "internship";

/** Remote is null on offers worked from the employer's site. */
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
  category_raw: string;
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

export interface JobsFile {
  scraped_at: string;
  sources: string[];
  count: number;
  jobs: Job[];
}

/** Nearest deadline first, best fit first, or newest first. */
export type Sort = "recent" | "closing" | "match";

export interface SalaryRange {
  min: number | null;
  max: number | null;
  /** Whether offers that publish no pay stay in; they are most of the board. */
  includeUnknown: boolean;
}

export interface JobsQuery {
  ids?: Set<string>;
  q?: string;
  /** The multi-value dimensions accept a set: a job matches any member. */
  levels?: Set<Level>;
  workModes?: Set<WorkMode>;
  categories?: Set<string>;
  sources?: Set<string>;
  jobTypes?: Set<JobType>;
  departments?: Set<string>;
  /** Rubros the person never wants to see again. */
  hiddenCategories?: Set<string>;
  hiddenDepartments?: Set<string>;
  salary?: SalaryRange;
  noExperience?: boolean;
  days?: number;
  sort?: Sort;
  /** Only read by the "match" sort; see rank.ts. */
  ranking?: Ranking;
  limit: number;
  offset: number;
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface JobsResponse {
  total: number;
  offset: number;
  limit: number;
  jobs: Job[];
}

export interface MetaResponse {
  count: number;
  scraped_at: string;
  sources: string[];
  categories: Facet[];
  departments: Facet[];
  no_experience_count: number;
}

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
