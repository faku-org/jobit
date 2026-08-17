export type Level = "entry" | "mid" | "senior";
export type Remote = "remote" | "hybrid";
export type JobType = "full_time" | "part_time" | "internship";
export type SourceId = "buscojobs" | "gallito";

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface DuplicateRef {
  source: SourceId;
  apply_url: string;
}

export interface Job {
  id: string;
  source: SourceId;
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
  vacancies: number | null;
  description: string;
  requirements: string | null;
  apply_url: string;
  duplicates: DuplicateRef[];
}

export interface JobsFile {
  scraped_at: string;
  sources: SourceId[];
  count: number;
  jobs: Job[];
}

/** A listing hit, before the detail request enriches it. */
export interface JobStub {
  source: SourceId;
  source_id: string;
  title: string;
  company: string | null;
  department: string | null;
  city: string | null;
  category_raw: string;
  date_posted: string;
  remote: Remote | null;
  job_type: JobType | null;
  no_experience: boolean;
  apply_url: string;
}

/** The extra fields only the detail page carries. */
export interface JobDetail {
  description: string;
  requirements: string | null;
  salary: Salary | null;
  experience_years_min: number | null;
  education_level: string | null;
  vacancies: number | null;
  no_experience: boolean;
  job_type: JobType | null;
}

export interface Source {
  id: SourceId;
  /** Every listing hit the source publishes, already rubro-tagged. */
  collect: (onProgress: (message: string) => void) => Promise<JobStub[]>;
  /** Detail fetch for one offer, called only for offers missing from cache. */
  detail: (stub: JobStub) => Promise<JobDetail | null>;
}
