import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { categoryFacets, departmentFacets, filterJobs } from "./filter.ts";
import { jobsFilePath, loadJobs } from "./store.ts";
import type { JobsQuery } from "./types.ts";

const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const jobsQuerySchema = t.Object({
  ids: t.Optional(t.String()),
  q: t.Optional(t.String()),
  level: t.Optional(t.Union([t.Literal("entry"), t.Literal("mid"), t.Literal("senior")])),
  remote: t.Optional(t.Union([t.Literal("remote"), t.Literal("hybrid")])),
  category: t.Optional(t.String()),
  department: t.Optional(t.String()),
  job_type: t.Optional(
    t.Union([t.Literal("full_time"), t.Literal("part_time"), t.Literal("internship")]),
  ),
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

      const ids = query.ids
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const params: JobsQuery = {
        ids: ids?.length ? new Set(ids) : undefined,
        q: query.q?.trim() || undefined,
        level: query.level,
        remote: query.remote,
        category: query.category || undefined,
        department: query.department || undefined,
        jobType: query.job_type,
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
