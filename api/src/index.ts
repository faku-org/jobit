import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { admin } from "./admin.ts";
import { adminEnabled } from "./auth.ts";
import { categoryFacets, departmentFacets, filterJobs } from "./filter.ts";
import { type Limit, clientKey, take } from "./limit.ts";
import { buildMarketReport } from "./market.ts";
import { type Ranking, isEmptyRanking } from "./rank.ts";
import { appendStats, statsFilePath, statsSchema } from "./stats.ts";
import { loadFeed } from "./feed.ts";
import { jobsFilePath } from "./store.ts";
import type { JobType, JobsQuery, Level, Result, SalaryRange, WorkMode } from "./types.ts";

const PORT = Number(process.env.PORT ?? 3000);
/**
 * Localhost by default: in production this sits behind nginx, and binding the
 * world would both expose it directly and make the forwarded header spoofable.
 * Set HOST to 0.0.0.0 to serve it straight, knowingly.
 */
const HOST = process.env.HOST ?? "127.0.0.1";
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Generous for somebody reading the board, which paginates fifty at a time. */
const READ_LIMIT: Limit = { windowMs: MINUTE, max: 120 };
/**
 * The browser sends this once a day. The ceiling is for the whole carrier NAT
 * behind one address, not for one person, and a refused row costs nothing:
 * the client swallows the failure rather than showing it to somebody job
 * hunting.
 */
const WRITE_LIMIT: Limit = { windowMs: HOUR, max: 20 };

/**
 * A failed read names a path on the box. That is nothing the browser can act
 * on and something an attacker would like, so it goes to the log and the
 * answer stays vague.
 */
function unavailable(error: string): string {
  console.error(`[jobit] ${error}`);
  return "las ofertas no están disponibles en este momento";
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_EDUCATION_RANK = 6;
const MAX_EXPERIENCE_YEARS = 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const LEVELS: readonly Level[] = ["entry", "mid", "senior"];
const WORK_MODES: readonly WorkMode[] = ["onsite", "remote", "hybrid"];
const JOB_TYPES: readonly JobType[] = ["full_time", "part_time", "internship"];

const splitList = (raw: string | undefined): string[] =>
  raw
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

const asSet = (values: string[]): Set<string> | undefined =>
  values.length > 0 ? new Set(values) : undefined;

/** The enum dimensions take a comma-separated list; a job matches any member. */
function parseSet<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
): Result<Set<T> | undefined> {
  const values = splitList(raw);
  if (values.length === 0) return { ok: true, value: undefined };

  const unknown = values.filter((value) => !(allowed as readonly string[]).includes(value));
  if (unknown.length > 0) {
    return { ok: false, error: `${name} inválido: ${unknown.join(", ")}` };
  }
  return { ok: true, value: new Set(values as T[]) };
}

/** Order carries the preference, so the ranking lists keep duplicates out
 * without going through a Set, which would say nothing about position. */
const parseOrdered = <T extends string>(raw: string | undefined, allowed: readonly T[]): T[] => {
  const values = splitList(raw).filter((value): value is T =>
    (allowed as readonly string[]).includes(value),
  );
  return [...new Set(values)];
};

const parseSalary = (
  min: number | undefined,
  max: number | undefined,
  includeUnknown: boolean | undefined,
): SalaryRange | undefined =>
  min === undefined && max === undefined
    ? undefined
    : {
        min: min ?? null,
        max: max ?? null,
        includeUnknown: includeUnknown !== false,
      };

const jobsQuerySchema = t.Object({
  ids: t.Optional(t.String()),
  q: t.Optional(t.String()),
  level: t.Optional(t.String()),
  remote: t.Optional(t.String()),
  category: t.Optional(t.String()),
  source: t.Optional(t.String()),
  department: t.Optional(t.String()),
  job_type: t.Optional(t.String()),
  hide_category: t.Optional(t.String()),
  hide_department: t.Optional(t.String()),
  salary_min: t.Optional(t.Numeric({ minimum: 0 })),
  salary_max: t.Optional(t.Numeric({ minimum: 0 })),
  salary_unknown: t.Optional(t.BooleanString()),
  no_experience: t.Optional(t.BooleanString()),
  days: t.Optional(t.Numeric({ minimum: 1 })),
  sort: t.Optional(t.Union([t.Literal("recent"), t.Literal("closing"), t.Literal("match")])),
  rank_category: t.Optional(t.String()),
  rank_department: t.Optional(t.String()),
  rank_mode: t.Optional(t.String()),
  rank_level: t.Optional(t.String()),
  rank_job_type: t.Optional(t.String()),
  rank_salary: t.Optional(t.Numeric({ minimum: 0 })),
  rank_no_experience: t.Optional(t.BooleanString()),
  rank_education: t.Optional(t.Numeric({ minimum: 0 })),
  rank_experience: t.Optional(t.Numeric({ minimum: 0 })),
  limit: t.Optional(t.Numeric()),
  offset: t.Optional(t.Numeric()),
});

type JobsQueryParams = typeof jobsQuerySchema.static;

/** The soft half of the query: everything that reorders instead of removing. */
function readRanking(query: JobsQueryParams): Ranking | undefined {
  const ranking: Ranking = {
    categories: splitList(query.rank_category),
    departments: splitList(query.rank_department),
    modes: parseOrdered(query.rank_mode, WORK_MODES),
    levels: parseOrdered(query.rank_level, LEVELS),
    jobTypes: parseOrdered(query.rank_job_type, JOB_TYPES),
    salaryTarget: query.rank_salary ?? null,
    noExperience: query.rank_no_experience === true,
    education:
      query.rank_education === undefined
        ? null
        : clamp(Math.round(query.rank_education), 0, MAX_EDUCATION_RANK),
    experienceYears:
      query.rank_experience === undefined
        ? null
        : clamp(Math.round(query.rank_experience), 0, MAX_EXPERIENCE_YEARS),
  };

  return isEmptyRanking(ranking) ? undefined : ranking;
}

export const app = new Elysia()
  .use(cors({ origin: CORS_ORIGINS }))
  /** Writing costs a line on disk, reading costs a scan of the board: the two
   * get their own budget, and their own bucket per client. */
  .onBeforeHandle(({ request, server, path, set, status }) => {
    const key = clientKey(request, server?.requestIP(request)?.address ?? null);
    const write = path === "/api/stats";
    const allowance = take(`${write ? "w" : "r"}:${key}`, write ? WRITE_LIMIT : READ_LIMIT);
    if (allowance.ok) return;

    set.headers["retry-after"] = String(allowance.retryAfter);
    return status(429, { error: "demasiadas peticiones" });
  })
  .onAfterHandle(({ set }) => {
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["referrer-policy"] = "no-referrer";
  })
  .get("/health", () => ({ status: "ok" }))
  .use(admin)
  .get(
    "/api/jobs",
    async ({ query, status }) => {
      const file = await loadFeed();
      if (!file.ok) return status(503, { error: unavailable(file.error) });

      const levels = parseSet("level", query.level, LEVELS);
      const workModes = parseSet("remote", query.remote, WORK_MODES);
      const jobTypes = parseSet("job_type", query.job_type, JOB_TYPES);
      const invalid = [levels, workModes, jobTypes].find((result) => !result.ok);
      if (invalid && !invalid.ok) return status(422, { error: invalid.error });

      const params: JobsQuery = {
        ids: asSet(splitList(query.ids)),
        q: query.q?.trim() || undefined,
        levels: levels.ok ? levels.value : undefined,
        workModes: workModes.ok ? workModes.value : undefined,
        categories: asSet(splitList(query.category)),
        sources: asSet(splitList(query.source)),
        departments: asSet(splitList(query.department)),
        hiddenCategories: asSet(splitList(query.hide_category)),
        hiddenDepartments: asSet(splitList(query.hide_department)),
        jobTypes: jobTypes.ok ? jobTypes.value : undefined,
        salary: parseSalary(query.salary_min, query.salary_max, query.salary_unknown),
        noExperience: query.no_experience || undefined,
        days: query.days,
        sort: query.sort,
        ranking: query.sort === "match" ? readRanking(query) : undefined,
        limit: clamp(Math.floor(query.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT),
        offset: Math.max(Math.floor(query.offset ?? 0), 0),
      };

      return filterJobs(file.value.jobs, params);
    },
    { query: jobsQuerySchema },
  )
  .get("/api/jobs/:id", async ({ params, status }) => {
    const file = await loadFeed();
    if (!file.ok) return status(503, { error: unavailable(file.error) });

    const job = file.value.jobs.find((candidate) => candidate.id === params.id);
    return job ?? status(404, { error: "oferta no encontrada" });
  })
  .get("/api/meta", async ({ status }) => {
    const file = await loadFeed();
    if (!file.ok) return status(503, { error: unavailable(file.error) });

    const { count, scraped_at, sources, jobs } = file.value;

    return {
      count,
      scraped_at,
      sources,
      categories: categoryFacets(jobs),
      departments: departmentFacets(jobs),
      no_experience_count: jobs.filter((job) => job.no_experience).length,
    };
  })
  /** The board as a whole, with nothing in it about the person asking. */
  .get("/api/market", async ({ status }) => {
    const file = await loadFeed();
    if (!file.ok) return status(503, { error: unavailable(file.error) });
    return buildMarketReport(file.value.jobs, file.value.scraped_at);
  })
  .post(
    "/api/stats",
    async ({ body, status }) => {
      try {
        await appendStats(body);
        return { status: "ok" };
      } catch (cause) {
        console.error(`[jobit] no se pudo escribir la estadística: ${String(cause)}`);
        return status(503, { error: "no se pudo registrar la estadística" });
      }
    },
    { body: statsSchema },
  );

if (import.meta.main) {
  app.listen({ port: PORT, hostname: HOST });
  console.log(`jobit api on http://${HOST}:${PORT}`);
  console.log(`reading ${jobsFilePath()}`);
  console.log(`stats -> ${statsFilePath()}`);
  console.log(`cors origins: ${CORS_ORIGINS.join(", ")}`);
  console.log(
    adminEnabled()
      ? "admin: habilitado"
      : "admin: apagado (falta ADMIN_PASSWORD_HASH), /api/admin responde 404",
  );
}
