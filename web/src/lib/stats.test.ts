import { describe, expect, test } from "bun:test";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";
import { anonymousStats } from "./stats.ts";

const profile: Profile = {
  ...EMPTY_PROFILE,
  education: "secondary",
  degrees: ["Bachillerato en Ciencias Biológicas, liceo de Solymar"],
  courses: ["Inglés B2", "Excel avanzado"],
  experienceYears: 3,
};

const usage = { saved: 6, applications: 2, interviews: 1, closed: 3, sources: ["buscojobs"] };

describe("anonymousStats", () => {
  test("reports counts, never the text the person typed", () => {
    const payload = anonymousStats(profile, usage);

    expect(payload).toEqual({
      education: "secondary",
      has_degree: true,
      degrees: 1,
      courses: 2,
      experience_years: 3,
      saved: 6,
      applications: 2,
      interviews: 1,
      closed: 3,
      sources: ["buscojobs"],
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("Solymar");
    expect(serialized).not.toContain("Inglés");
    expect(serialized).not.toContain("Excel");
  });

  test("an untouched profile carries nothing about the person", () => {
    expect(
      anonymousStats(EMPTY_PROFILE, {
        saved: 0,
        applications: 0,
        interviews: 0,
        closed: 0,
        sources: [],
      }),
    ).toEqual({
      education: "",
      has_degree: false,
      degrees: 0,
      courses: 0,
      experience_years: null,
      saved: 0,
      applications: 0,
      interviews: 0,
      closed: 0,
      sources: [],
    });
  });

  test("drops source names it does not know and clamps the counters", () => {
    const payload = anonymousStats(
      { ...EMPTY_PROFILE, experienceYears: 999 },
      {
        saved: -3,
        applications: 99_999,
        interviews: 0,
        closed: 0,
        sources: ["buscojobs", "algo-raro"],
      },
    );

    expect(payload.sources).toEqual(["buscojobs"]);
    expect(payload.experience_years).toBe(60);
    expect(payload.saved).toBe(0);
    expect(payload.applications).toBe(10_000);
  });
});
