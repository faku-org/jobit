import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { t } from "elysia";

/**
 * Anonymous usage rows. Everything the browser knows about a person -- the
 * degrees they typed, the courses, the jobs they saved -- stays in the browser:
 * only these coarse counts arrive here, with no identifier of any kind, and the
 * request's IP and user agent are deliberately not recorded.
 */
export const statsSchema = t.Object({
  education: t.Union([
    t.Literal(""),
    t.Literal("none"),
    t.Literal("primary"),
    t.Literal("secondary_basic"),
    t.Literal("secondary"),
    t.Literal("technical"),
    t.Literal("university"),
    t.Literal("postgrad"),
  ]),
  has_degree: t.Boolean(),
  degrees: t.Integer({ minimum: 0, maximum: 50 }),
  courses: t.Integer({ minimum: 0, maximum: 99 }),
  experience_years: t.Union([t.Integer({ minimum: 0, maximum: 60 }), t.Null()]),
  saved: t.Integer({ minimum: 0, maximum: 10_000 }),
  applications: t.Integer({ minimum: 0, maximum: 10_000 }),
  sources: t.Array(
    t.Union([t.Literal("buscojobs"), t.Literal("gallito"), t.Literal("uruguayconcursa")]),
    { maxItems: 5 },
  ),
});

export type StatsRow = typeof statsSchema.static;

export const statsFilePath = (): string =>
  process.env.STATS_FILE
    ? resolve(process.env.STATS_FILE)
    : resolve(import.meta.dir, "../../data/stats.jsonl");

/** One JSON object per line, stamped with the day only, never the exact time. */
export async function appendStats(row: StatsRow): Promise<void> {
  const path = statsFilePath();
  await mkdir(dirname(path), { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  await appendFile(path, `${JSON.stringify({ day, ...row })}\n`, "utf8");
}
