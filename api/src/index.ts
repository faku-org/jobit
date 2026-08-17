import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { filterJobs } from "./filter.ts";
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
  q: t.Optional(t.String()),
  level: t.Optional(t.Union([t.Literal("entry"), t.Literal("mid"), t.Literal("senior")])),
  remote: t.Optional(t.Union([t.Literal("remote"), t.Literal("hybrid")])),
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

      const params: JobsQuery = {
        q: query.q?.trim() || undefined,
        level: query.level,
        remote: query.remote,
        days: query.days,
        limit: clamp(Math.floor(query.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT),
        offset: Math.max(Math.floor(query.offset ?? 0), 0),
      };

      return filterJobs(file.value.jobs, params);
    },
    { query: jobsQuerySchema },
  )
  .get("/api/meta", async ({ status }) => {
    const file = await loadJobs();
    if (!file.ok) return status(503, { error: file.error });

    const { count, scraped_at, source } = file.value;
    return { count, scraped_at, source };
  });

if (import.meta.main) {
  app.listen(PORT);
  console.log(`jobit api on http://localhost:${PORT}`);
  console.log(`reading ${jobsFilePath()}`);
  console.log(`cors origins: ${CORS_ORIGINS.join(", ")}`);
}
