import type { Profile } from "./profile.ts";

/** Counters the app can report about usage, none of them tied to a person. */
export interface Usage {
  saved: number;
  applications: number;
  /** Postulaciones que dejaron de estar en "aplicada": cuántas siguieron a
   * entrevista y cuántas se cerraron. */
  interviews: number;
  closed: number;
  sources: string[];
}

/**
 * The whole payload that ever leaves the browser. It is built here, in one
 * place, so what is shared can be read at a glance and shown to the person
 * verbatim: coarse counts and one education level, no free text, no
 * identifier, no id of a job, company or application.
 */
export interface AnonymousStats {
  education: Profile["education"];
  has_degree: boolean;
  degrees: number;
  courses: number;
  experience_years: number | null;
  saved: number;
  applications: number;
  interviews: number;
  closed: number;
  sources: string[];
}

const KNOWN_SOURCES = ["jobit", "buscojobs", "gallito", "uruguayconcursa"];

const cap = (value: number, max: number): number => Math.min(Math.max(Math.round(value), 0), max);

export function anonymousStats(profile: Profile, usage: Usage): AnonymousStats {
  return {
    education: profile.education,
    has_degree: profile.degrees.length > 0,
    degrees: cap(profile.degrees.length, 50),
    courses: cap(profile.courses.length, 99),
    experience_years: profile.experienceYears === null ? null : cap(profile.experienceYears, 60),
    saved: cap(usage.saved, 10_000),
    applications: cap(usage.applications, 10_000),
    interviews: cap(usage.interviews, 10_000),
    closed: cap(usage.closed, 10_000),
    sources: usage.sources.filter((source) => KNOWN_SOURCES.includes(source)).slice(0, 5),
  };
}
