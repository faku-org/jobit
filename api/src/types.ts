export type Level = "entry" | "mid" | "senior";
export type Remote = "remote" | "hybrid";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  date_posted: string;
  level: Level | null;
  remote: Remote | null;
  apply_url: string;
}

export interface JobsFile {
  scraped_at: string;
  source: string;
  count: number;
  jobs: Job[];
}

export interface JobsQuery {
  q?: string;
  level?: Level;
  remote?: Remote;
  days?: number;
  limit: number;
  offset: number;
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
  source: string;
}

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
