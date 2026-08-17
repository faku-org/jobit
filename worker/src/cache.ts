import { resolve } from "node:path";
import type { SourceId } from "./types.ts";

const CACHE_PATH = resolve(import.meta.dir, "../cache/details.json");

type CacheKey = `${SourceId}:${string}`;
type CacheFile = Record<CacheKey, unknown>;

/**
 * Detail pages are the expensive part of a run, so the raw payloads are kept
 * on disk and only fetched for offers that were never seen before. Storing them
 * unmapped means adding a field to the schema costs no extra requests.
 */
export class DetailCache {
  private entries: CacheFile = {};
  private dirty = false;

  static async load(): Promise<DetailCache> {
    const cache = new DetailCache();
    const file = Bun.file(CACHE_PATH);
    if (await file.exists()) {
      try {
        cache.entries = (await file.json()) as CacheFile;
      } catch {
        console.warn("  ! cache corrupta, se reconstruye");
      }
    }
    return cache;
  }

  get(source: SourceId, sourceId: string): unknown | undefined {
    return this.entries[`${source}:${sourceId}`];
  }

  set(source: SourceId, sourceId: string, raw: unknown): void {
    this.entries[`${source}:${sourceId}`] = raw;
    this.dirty = true;
  }

  /** Drops entries for offers that are no longer listed. */
  prune(liveKeys: Set<string>): number {
    let removed = 0;
    for (const key of Object.keys(this.entries) as CacheKey[]) {
      if (!liveKeys.has(key)) {
        delete this.entries[key];
        removed++;
      }
    }
    if (removed > 0) this.dirty = true;
    return removed;
  }

  get size(): number {
    return Object.keys(this.entries).length;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    await Bun.write(CACHE_PATH, JSON.stringify(this.entries));
    this.dirty = false;
  }
}
