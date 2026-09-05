import { describe, expect, test } from "bun:test";
import { keepIfEmpty } from "./keep.ts";
import type { Job } from "./types.ts";

const job = (source: Job["source"], source_id: string): Job =>
  ({ source, source_id }) as Job;

const previous = [
  job("buscojobs", "1"),
  job("buscojobs", "2"),
  job("uruguayconcursa", "9"),
];

describe("keepIfEmpty", () => {
  test("a live listing replaces what was stored", () => {
    expect(keepIfEmpty("buscojobs", 10, previous)).toBeNull();
  });

  test("an empty listing keeps the previous offers from that source", () => {
    const kept = keepIfEmpty("buscojobs", 0, previous);
    expect(kept?.map((entry) => entry.source_id)).toEqual(["1", "2"]);
  });

  test("an empty listing with nothing stored stays empty", () => {
    expect(keepIfEmpty("buscojobs", 0, [])).toBeNull();
    expect(keepIfEmpty("buscojobs", 0, undefined)).toBeNull();
  });
});
