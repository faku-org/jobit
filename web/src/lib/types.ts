export type Level = "entry" | "mid" | "senior";
export type Remote = "remote" | "hybrid";
export type JobType = "full_time" | "part_time" | "internship";

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
  remote: Remote | "";
  jobType: JobType | "";
  noExperience: boolean;
  days: number | null;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  category: "",
  department: "",
  level: "",
  remote: "",
  jobType: "",
  noExperience: false,
  days: null,
};

export const hasActiveFilters = (filters: Filters): boolean =>
  filters.q !== "" ||
  filters.category !== "" ||
  filters.department !== "" ||
  filters.level !== "" ||
  filters.remote !== "" ||
  filters.jobType !== "" ||
  filters.noExperience ||
  filters.days !== null;
