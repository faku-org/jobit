import { describe, expect, test } from "bun:test";
import { readViewState } from "./url.ts";
import { EMPTY_FILTERS } from "./types.ts";

describe("readViewState", () => {
  test("opens the board with nothing in the address bar", () => {
    expect(readViewState("")).toEqual({ view: "all", filters: EMPTY_FILTERS });
  });

  test("lands on the section the link names", () => {
    expect(readViewState("?view=market").view).toBe("market");
    expect(readViewState("?view=state").view).toBe("state");
  });

  test("falls back to the board on a section that does not exist", () => {
    expect(readViewState("?view=inventada").view).toBe("all");
  });

  test("reads the filters under the names the API takes", () => {
    expect(readViewState("?category=salud&department=Canelones&remote=hybrid").filters).toEqual({
      ...EMPTY_FILTERS,
      category: "salud",
      department: "Canelones",
      mode: "hybrid",
    });
  });

  test("keeps the search text", () => {
    expect(readViewState("?q=aux+de+cocina").filters.q).toBe("aux de cocina");
  });

  test("drops a value outside its dimension instead of asking the API for it", () => {
    const filters = readViewState("?level=experto&job_type=weekend&remote=teleport").filters;
    expect(filters.level).toBe("");
    expect(filters.jobType).toBe("");
    expect(filters.mode).toBe("");
  });

  test("only true turns the no-experience filter on", () => {
    expect(readViewState("?no_experience=true").filters.noExperience).toBe(true);
    expect(readViewState("?no_experience=1").filters.noExperience).toBe(false);
  });

  test("takes a window of days and ignores the ones that are not one", () => {
    expect(readViewState("?days=7").filters.days).toBe(7);
    expect(readViewState("?days=0").filters.days).toBeNull();
    expect(readViewState("?days=-3").filters.days).toBeNull();
    expect(readViewState("?days=ayer").filters.days).toBeNull();
    expect(readViewState("?days=1.5").filters.days).toBeNull();
  });

  test("ignores what belongs to the shared offer and to the embed", () => {
    const state = readViewState("?job=abc123&embed=abc123&view=saved");
    expect(state.view).toBe("saved");
    expect(state.filters).toEqual(EMPTY_FILTERS);
  });

  test("caps a search long enough to be somebody playing", () => {
    expect(readViewState(`?q=${"a".repeat(500)}`).filters.q).toHaveLength(200);
  });
});
