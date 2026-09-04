import { describe, expect, test } from "bun:test";
import { readDevFlags } from "./dev.ts";

describe("readDevFlags", () => {
  test("nothing asked, nothing on", () => {
    expect(readDevFlags("")).toEqual({ onboarding: false });
    expect(readDevFlags("?view=saved")).toEqual({ onboarding: false });
  });

  test("the onboarding replays when it is named", () => {
    expect(readDevFlags("?dev=onboarding").onboarding).toBe(true);
    expect(readDevFlags("?dev=all").onboarding).toBe(true);
    expect(readDevFlags("?view=saved&dev=onboarding").onboarding).toBe(true);
  });

  test("a switch that does not exist turns nothing on", () => {
    expect(readDevFlags("?dev=").onboarding).toBe(false);
    expect(readDevFlags("?dev=cualquiera").onboarding).toBe(false);
  });

  test("switches travel together, with room for spaces", () => {
    expect(readDevFlags("?dev=otro, onboarding").onboarding).toBe(true);
  });
});
