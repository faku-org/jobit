import { describe, expect, test } from "bun:test";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";
import { assessFit } from "./fit.ts";
import type { Job } from "./types.ts";

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "a",
  source: "buscojobs",
  source_id: "1",
  title: "Cadete",
  company: "X",
  department: "Montevideo",
  city: "Montevideo",
  category: "administracion",
  category_label: "Administración",
  date_posted: "2026-08-01T00:00:00",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: 1,
  closes_at: null,
  description: "",
  requirements: null,
  apply_url: "https://ejemplo.uy/1",
  duplicates: [],
  ...overrides,
});

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  ...overrides,
});

const experience = (fit: ReturnType<typeof assessFit>) =>
  fit.checks.find((check) => check.id === "experience");

describe("experienceCheck", () => {
  test("a first-job offer does not mention how many years you have", () => {
    const check = experience(
      assessFit(job({ no_experience: true }), profile({ experienceYears: 0 })),
    );
    expect(check?.asks).toBe("No pide experiencia previa");
    expect(check?.yours).toBe("");
    expect(check?.status).toBe("ok");
  });

  test("years of experience stay off even when the person has some", () => {
    const check = experience(
      assessFit(job({ no_experience: true }), profile({ experienceYears: 5 })),
    );
    expect(check?.yours).toBe("");
  });

  test("zero years against a required amount is said as not having experience", () => {
    const check = experience(
      assessFit(job({ experience_years_min: 2 }), profile({ experienceYears: 0 })),
    );
    expect(check?.asks).toBe("2 años de experiencia");
    expect(check?.yours).toBe("No tenés experiencia");
    expect(check?.status).toBe("short");
  });

  test("meeting the asked years is said in the affirmative", () => {
    const check = experience(
      assessFit(job({ experience_years_min: 2 }), profile({ experienceYears: 5 })),
    );
    expect(check?.yours).toBe("Tenés 5 años");
    expect(check?.status).toBe("ok");
  });
});
