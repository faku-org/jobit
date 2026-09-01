import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { categoryFacets, departmentFacets, filterJobs } from "./filter.ts";
import { jobsFilePath, loadJobs } from "./store.ts";
import type { JobType, JobsQuery, Level, Result, WorkMode } from "./types.ts";

const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

const jobsQuerySchema = t.Object({
  ids: t.Optional(t.String()),
  q: t.Optional(t.String()),
  level: t.Optional(t.String()),
  remote: t.Optional(t.String()),
  category: t.Optional(t.String()),
  department: t.Optional(t.String()),
  job_type: t.Optional(t.String()),
  no_experience: t.Optional(t.BooleanString()),
  days: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric()),
  offset: t.Optional(t.Numeric()),
});

export const app = new Elysia()
  .use(cors({ origin: CORS_ORIGINS }))
  .get("/health", () => ({ status: "ok" }))
  .get(
    "/api/jobs",
    async ({ query, status }) => {
      const file = await loadJobs();
      if (!file.ok) return status(503, { error: file.error });

      const levels = parseSet("level", query.level, LEVELS);
      const workModes = parseSet("remote", query.remote, WORK_MODES);
      const jobTypes = parseSet("job_type", query.job_type, JOB_TYPES);
      const invalid = [levels, workModes, jobTypes].find((result) => !result.ok);
      if (invalid && !invalid.ok) return status(422, { error: invalid.error });

      const ids = splitList(query.ids);
      const categories = splitList(query.category);

      const params: JobsQuery = {
        ids: ids.length ? new Set(ids) : undefined,
        q: query.q?.trim() || undefined,
        levels: levels.ok ? levels.value : undefined,
        workModes: workModes.ok ? workModes.value : undefined,
        categories: categories.length ? new Set(categories) : undefined,
        department: query.department || undefined,
        jobTypes: jobTypes.ok ? jobTypes.value : undefined,
        noExperience: query.no_experience || undefined,
        days: query.days,
        limit: clamp(Math.floor(query.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT),
        offset: Math.max(Math.floor(query.offset ?? 0), 0),
      };

      return filterJobs(file.value.jobs, params);
    },
    { query: jobsQuerySchema },
  )
  .get("/api/jobs/:id", async ({ params, status }) => {
    const file = await loadJobs();
    if (!file.ok) return status(503, { error: file.error });

    const job = file.value.jobs.find((candidate) => candidate.id === params.id);
    return job ?? status(404, { error: "oferta no encontrada" });
  })
  .get("/api/meta", async ({ status }) => {
    const file = await loadJobs();
    if (!file.ok) return status(503, { error: file.error });

    const { count, scraped_at, sources, jobs } = file.value;

    return {
      count,
      scraped_at,
      sources,
      categories: categoryFacets(jobs),
      departments: departmentFacets(jobs),
      no_experience_count: jobs.filter((job) => job.no_experience).length,
    };
  });

if (import.meta.main) {
  app.listen(PORT);
  console.log(`jobit api on http://localhost:${PORT}`);
  console.log(`reading ${jobsFilePath()}`);
  console.log(`cors origins: ${CORS_ORIGINS.join(", ")}`);
}
