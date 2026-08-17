import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Job, JobsFile, Result } from "./types.ts";

const DEFAULT_PATH = resolve(import.meta.dir, "../../worker/output/jobs.json");

export const jobsFilePath = (): string =>
  process.env.JOBS_FILE ? resolve(process.env.JOBS_FILE) : DEFAULT_PATH;

interface Cache {
  mtimeMs: number;
  data: JobsFile;
}

let cache: Cache | null = null;

function isJob(value: unknown): value is Job {
  if (typeof value !== "object" || value === null) return false;
  const job = value as Record<string, unknown>;
  return (
    typeof job.id === "string" &&
    typeof job.title === "string" &&
    typeof job.category === "string" &&
    typeof job.date_posted === "string" &&
    typeof job.apply_url === "string"
  );
}

function parse(raw: unknown): Result<JobsFile> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "jobs file is not an object" };
  }
  const file = raw as Record<string, unknown>;
  if (!Array.isArray(file.jobs) || !file.jobs.every(isJob)) {
    return { ok: false, error: 'jobs file has no valid "jobs" array' };
  }
  const jobs = [...(file.jobs as Job[])].sort((a, b) => b.date_posted.localeCompare(a.date_posted));
  return {
    ok: true,
    value: {
      scraped_at: typeof file.scraped_at === "string" ? file.scraped_at : "",
      sources: Array.isArray(file.sources) ? (file.sources as string[]) : [],
      count: typeof file.count === "number" ? file.count : jobs.length,
      jobs,
    },
  };
}

/**
 * Reads the scraper output, re-reading only when the file's mtime changes so a
 * manual refresh of jobs.json is picked up without a restart.
 */
export async function loadJobs(): Promise<Result<JobsFile>> {
  const path = jobsFilePath();
  let mtimeMs: number;
  try {
    mtimeMs = (await stat(path)).mtimeMs;
  } catch {
    return { ok: false, error: `jobs file not found at ${path}` };
  }

  if (cache && cache.mtimeMs === mtimeMs) return { ok: true, value: cache.data };

  let raw: unknown;
  try {
    raw = await Bun.file(path).json();
  } catch (cause) {
    return { ok: false, error: `jobs file is not valid JSON: ${String(cause)}` };
  }

  const parsed = parse(raw);
  if (parsed.ok) cache = { mtimeMs, data: parsed.value };
  return parsed;
}

export function clearCache(): void {
  cache = null;
}
