import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMarketDay, readHistory, recordDay, serializeDay } from "./history.ts";
import type { Job } from "./types.ts";

const job = (overrides: Partial<Job> & Pick<Job, "source_id">): Job =>
  ({
    source: "buscojobs",
    title: "Vendedor de salón",
    company: "Empresa SA",
    department: "Montevideo",
    category: "ventas",
    salary: null,
    ...overrides,
  }) as Job;

const pay = (min: number): Job["salary"] => ({ min, max: null, currency: "UYU" });

const jobs = [
  job({ source_id: "1", salary: pay(30_000) }),
  job({ source_id: "2", salary: pay(32_000) }),
  job({ source_id: "3", salary: pay(34_000) }),
  job({ source_id: "4", salary: pay(36_000) }),
  job({ source_id: "5", salary: pay(38_000) }),
  job({ source_id: "6", salary: pay(1) }),
  job({ source_id: "7", department: "Salto", category: "tecnologia", title: "Cocinero" }),
];

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobit-history-"));
  path = join(dir, "nested", "market-history.jsonl");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("buildMarketDay", () => {
  test("counts the board and groups by role, rubro and department", () => {
    const row = buildMarketDay(jobs, "2026-09-02T10:00:00.000Z");

    expect(row.day).toBe("2026-09-02");
    expect(row.total).toBe(7);
    expect(row.categories.ventas?.count).toBe(6);
    expect(row.categories.tecnologia?.count).toBe(1);
    expect(row.departments.Montevideo?.count).toBe(6);
    expect(row.departments.Salto?.count).toBe(1);
  });

  test("drops incredible salaries and hides pay under five offers", () => {
    const row = buildMarketDay(jobs, "2026-09-02T10:00:00.000Z");

    expect(row.withSalary).toBe(5);
    expect(row.salary?.count).toBe(5);
    expect(row.salary?.median).toBe(34_000);
    expect(row.categories.tecnologia?.salary).toBeNull();
  });

  test("keeps aggregates only: no offer, company or person survives", () => {
    const line = serializeDay(buildMarketDay(jobs, "2026-09-02T10:00:00.000Z"));

    expect(line).not.toContain("Empresa SA");
    expect(line).not.toContain("source_id");
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).day).toBe("2026-09-02");
  });
});

describe("history file", () => {
  test("a missing file reads as an empty series", async () => {
    expect(await readHistory(path)).toEqual([]);
  });

  test("an empty file reads as an empty series", async () => {
    await Bun.write(path, "");
    expect(await readHistory(path)).toEqual([]);
  });

  test("a series of several days reads back in chronological order", async () => {
    await recordDay(buildMarketDay(jobs, "2026-09-03T10:00:00.000Z"), path);
    await recordDay(buildMarketDay(jobs.slice(0, 5), "2026-09-01T10:00:00.000Z"), path);
    await recordDay(buildMarketDay(jobs, "2026-09-02T10:00:00.000Z"), path);

    const series = await readHistory(path);
    expect(series.map((row) => row.day)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(series[0]?.total).toBe(5);
    expect(series[2]?.total).toBe(7);
  });

  test("writes one JSON object per line", async () => {
    await recordDay(buildMarketDay(jobs, "2026-09-01T10:00:00.000Z"), path);
    await recordDay(buildMarketDay(jobs, "2026-09-02T10:00:00.000Z"), path);

    const lines = (await Bun.file(path).text()).trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  });

  test("running twice the same day keeps one row, the latest", async () => {
    await recordDay(buildMarketDay(jobs.slice(0, 5), "2026-09-02T04:00:00.000Z"), path);
    await recordDay(buildMarketDay(jobs, "2026-09-02T22:00:00.000Z"), path);

    const series = await readHistory(path);
    expect(series).toHaveLength(1);
    expect(series[0]?.total).toBe(7);
    expect(series[0]?.scraped_at).toBe("2026-09-02T22:00:00.000Z");
  });

  test("same-day replacement leaves the other days untouched", async () => {
    await recordDay(buildMarketDay(jobs, "2026-09-01T10:00:00.000Z"), path);
    await recordDay(buildMarketDay(jobs, "2026-09-02T04:00:00.000Z"), path);
    await recordDay(buildMarketDay(jobs.slice(0, 5), "2026-09-02T22:00:00.000Z"), path);

    const series = await readHistory(path);
    expect(series.map((row) => row.total)).toEqual([7, 5]);
  });

  test("a garbled line is skipped instead of failing the read", async () => {
    await Bun.write(path, `not json\n${serializeDay(buildMarketDay(jobs, "2026-09-02T10:00:00.000Z"))}\n`);
    expect((await readHistory(path)).map((row) => row.day)).toEqual(["2026-09-02"]);
  });
});
