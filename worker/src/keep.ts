import type { Job, SourceId } from "./types.ts";

/**
 * If a source lists nothing this run but the previous file had offers from it,
 * keep those. BuscoJobs is the board: a blocked request or a missing buildId
 * used to write zero jobs and wipe the tablero until the next lucky scrape.
 */
export function keepIfEmpty(
  sourceId: SourceId,
  listed: number,
  previous: Job[] | undefined,
): Job[] | null {
  if (listed > 0) return null;
  const kept = previous?.filter((job) => job.source === sourceId) ?? [];
  return kept.length > 0 ? kept : null;
}
