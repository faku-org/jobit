import type { Salary } from "./types.ts";

/**
 * Pay is typed by hand into each job board, and it shows: a monthly salary of
 * 1 and one of 11.111.111 are both in the data. Anything outside this window
 * is a typo rather than an offer, and one of them is enough to wreck an
 * average, so they are dropped before anything is computed.
 *
 * Vive en el worker porque lo usan dos lectores del mismo dato: el informe de
 * mercado de la API y el histórico que escribe el scrapeo. Una sola ventana
 * evita que el histórico y el informe discrepen sobre qué sueldo es creíble.
 */
const MIN_CREDIBLE_SALARY = 8_000;
const MAX_CREDIBLE_SALARY = 900_000;

/** A distribution said with quartiles: an average would be dragged by the tail. */
export interface SalarySummary {
  /** How many offers this was computed from; the rest publish no pay. */
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

/** The monthly figure an offer publishes, once it is believable. */
export function monthlyPayOf(job: { salary: Salary | null }): number | null {
  if (!job.salary) return null;
  /** Ranges are read at their floor: it is the number the person is promised. */
  const value = job.salary.min ?? job.salary.max;
  if (value === null) return null;
  if (value < MIN_CREDIBLE_SALARY || value > MAX_CREDIBLE_SALARY) return null;
  return value;
}

const quantile = (sorted: number[], fraction: number): number =>
  sorted[Math.min(Math.floor(sorted.length * fraction), sorted.length - 1)] ?? 0;

/** Null under a handful of offers: three salaries are an anecdote, not a range. */
export function summarize(values: number[], minimum = 5): SalarySummary | null {
  if (values.length < minimum) return null;
  const sorted = [...values].sort((a, b) => a - b);

  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}
