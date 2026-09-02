import type { Job, JobType, Level, Remote, Salary } from "./types.ts";

/**
 * An extra job board somebody points the app at. The bundled sources are
 * scraped by the worker, which means adding one is a code change; this is the
 * escape hatch for the people who can produce a feed themselves.
 *
 * The feed is read in the browser, so it has to be reachable from it: served
 * over https with CORS open. Nothing about it reaches the API.
 */
export interface CustomFeed {
  id: string;
  url: string;
  label: string;
  enabled: boolean;
}

export const MAX_FEEDS = 5;
/** A feed is a supplement to the board, not a replacement for it. */
export const MAX_FEED_JOBS = 200;

export const newFeedId = (): string =>
  `feed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Only http(s): a feed url is fetched, so nothing else can be one. */
export function isFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const LEVELS: Level[] = ["entry", "mid", "senior"];
const REMOTES: Remote[] = ["remote", "hybrid"];
const JOB_TYPES: JobType[] = ["full_time", "part_time", "internship"];

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const nullableStr = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const oneOf = <T extends string>(value: unknown, allowed: T[]): T | null =>
  typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function readSalary(value: unknown): Salary | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const min = num(raw.min);
  const max = num(raw.max);
  if (min === null && max === null) return null;
  return { min, max, currency: str(raw.currency, "UYU") };
}

/**
 * One entry of a feed turned into a Job, or null when it does not carry the
 * two things the app cannot invent: something to show and somewhere to apply.
 * Everything else gets a defensible default rather than rejecting the row.
 */
export function readFeedJob(value: unknown, feed: CustomFeed): Job | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const title = str(raw.title).trim();
  const applyUrl = str(raw.apply_url ?? raw.url).trim();
  if (!title || !isFeedUrl(applyUrl)) return null;

  const sourceId = str(raw.id ?? raw.source_id, applyUrl);
  const posted = str(raw.date_posted ?? raw.published_at);

  return {
    /** Namespaced so a feed can never collide with the board's own ids. */
    id: `${feed.id}:${sourceId}`,
    source: feed.id,
    source_id: sourceId,
    title,
    company: nullableStr(raw.company),
    department: nullableStr(raw.department),
    city: nullableStr(raw.city),
    category: str(raw.category, "otros"),
    category_label: str(raw.category_label, feed.label),
    date_posted: Number.isNaN(Date.parse(posted)) ? new Date().toISOString() : posted,
    level: oneOf(raw.level, LEVELS),
    remote: oneOf(raw.remote, REMOTES),
    job_type: oneOf(raw.job_type, JOB_TYPES),
    salary: readSalary(raw.salary),
    experience_years_min: num(raw.experience_years_min),
    no_experience: raw.no_experience === true,
    education_level: nullableStr(raw.education_level),
    schedule: nullableStr(raw.schedule),
    vacancies: num(raw.vacancies),
    closes_at: nullableStr(raw.closes_at),
    description: str(raw.description),
    requirements: nullableStr(raw.requirements),
    apply_url: applyUrl,
    duplicates: [],
  };
}

export interface FeedResult {
  feedId: string;
  jobs: Job[];
  /** Said in words the person can act on, not the raw exception. */
  error: string | null;
}

/** Both shapes are accepted: the response object, or a bare array of offers. */
function entriesOf(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && payload !== null) {
    const jobs = (payload as Record<string, unknown>).jobs;
    if (Array.isArray(jobs)) return jobs;
  }
  return null;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchFeed(feed: CustomFeed, signal?: AbortSignal): Promise<FeedResult> {
  const empty = { feedId: feed.id, jobs: [] };

  if (!isFeedUrl(feed.url)) {
    return { ...empty, error: "La dirección tiene que empezar con https://" };
  }

  try {
    const response = await fetch(feed.url, {
      signal: signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { ...empty, error: `Respondió ${response.status}` };

    const entries = entriesOf(await response.json());
    if (entries === null) {
      return { ...empty, error: 'Esperaba un array de ofertas o un objeto con "jobs"' };
    }

    const jobs = entries.slice(0, MAX_FEED_JOBS).flatMap((entry) => {
      const job = readFeedJob(entry, feed);
      return job ? [job] : [];
    });

    if (jobs.length === 0) {
      return { ...empty, error: "Ninguna entrada tenía title y apply_url" };
    }
    return { feedId: feed.id, jobs, error: null };
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return { ...empty, error: "Tardó demasiado en responder" };
    }
    /** A CORS refusal reaches the page as an opaque TypeError and nothing else. */
    return { ...empty, error: "No se pudo leer. ¿Está publicada con CORS abierto?" };
  }
}
