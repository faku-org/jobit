import { describe, expect, test } from "bun:test";
import { filterJobs } from "./filter.ts";
import type { Job } from "./types.ts";

const NOW = Date.parse("2026-08-17T00:00:00Z");

const job = (overrides: Partial<Job> & Pick<Job, "id">): Job => ({
  title: "Desarrollador Full Stack",
  company: "Empresa SA",
  location: "Montevideo, Uruguay",
  date_posted: "2026-08-16T00:00:00",
  level: "mid",
  remote: null,
  apply_url: "https://uy.linkedin.com/jobs/view/1",
  ...overrides,
});

const base = { limit: 50, offset: 0 };

const jobs: Job[] = [
  job({ id: "a", title: "Desarrollador React Junior", level: "entry" }),
  job({
    id: "b",
    title: "Ingeniero DevOps Senior",
    company: "dLocal",
    level: "senior",
    remote: "remote",
    location: "Uruguay",
  }),
  job({
    id: "c",
    title: "Analista QA",
    level: null,
    remote: "hybrid",
    date_posted: "2026-07-01T00:00:00",
  }),
];

describe("filterJobs", () => {
  test("returns everything when no filters are given", () => {
    const result = filterJobs(jobs, base, NOW);
    expect(result.total).toBe(3);
    expect(result.jobs).toHaveLength(3);
  });

  test("q matches title, company and location, case-insensitively", () => {
    expect(filterJobs(jobs, { ...base, q: "react" }, NOW).jobs[0]?.id).toBe("a");
    expect(filterJobs(jobs, { ...base, q: "DLOCAL" }, NOW).jobs[0]?.id).toBe("b");
    expect(filterJobs(jobs, { ...base, q: "montevideo" }, NOW).total).toBe(2);
  });

  test("q requires every term to match", () => {
    expect(filterJobs(jobs, { ...base, q: "devops senior" }, NOW).total).toBe(1);
    expect(filterJobs(jobs, { ...base, q: "devops junior" }, NOW).total).toBe(0);
  });

  test("level filter excludes null levels", () => {
    expect(filterJobs(jobs, { ...base, level: "entry" }, NOW).jobs).toEqual([jobs[0]!]);
    expect(filterJobs(jobs, { ...base, level: "mid" }, NOW).total).toBe(0);
  });

  test("remote filter keeps only the requested modality", () => {
    expect(filterJobs(jobs, { ...base, remote: "hybrid" }, NOW).jobs[0]?.id).toBe("c");
  });

  test("days filter drops older offers", () => {
    expect(filterJobs(jobs, { ...base, days: 7 }, NOW).total).toBe(2);
    expect(filterJobs(jobs, { ...base, days: 60 }, NOW).total).toBe(3);
  });

  test("filters combine", () => {
    const result = filterJobs(
      jobs,
      { ...base, q: "uruguay", remote: "remote", level: "senior", days: 7 },
      NOW,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["b"]);
  });

  test("pagination reports the full total", () => {
    const result = filterJobs(jobs, { limit: 1, offset: 1 }, NOW);
    expect(result).toMatchObject({ total: 3, offset: 1, limit: 1 });
    expect(result.jobs.map((j) => j.id)).toEqual(["b"]);
  });

  test("offset past the end yields no jobs", () => {
    expect(filterJobs(jobs, { limit: 50, offset: 99 }, NOW).jobs).toEqual([]);
  });
});
