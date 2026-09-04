import { EDUCATION_RANK, type Profile } from "./profile.ts";
import type { JobType, Level, Preferences, WorkMode } from "./types.ts";

/**
 * The soft half of a query: what should come first, as opposed to what should
 * come back at all. It mirrors the shape the API scores against in rank.ts, so
 * the app decides what it wants and the API decides the order over the whole
 * board instead of over the page that happens to be loaded.
 */
export interface Ranking {
  categories: string[];
  departments: string[];
  modes: WorkMode[];
  levels: Level[];
  jobTypes: JobType[];
  salaryTarget: number | null;
  noExperience: boolean;
  /** Education held, on the same 0-6 scale as EDUCATION_RANK. */
  education: number | null;
  experienceYears: number | null;
}

/**
 * Everything the person said about themselves and about what they want, in
 * one object. The profile is half of it: someone with a bachillerato and no
 * experience should not open the app to a wall of senior positions, and that
 * is decided here rather than in the profile panel.
 */
export function toRanking(preferences: Preferences, profile: Profile): Ranking {
  return {
    categories: preferences.categories,
    departments: preferences.departments,
    modes: preferences.modes,
    levels: preferences.levels,
    jobTypes: preferences.jobTypes,
    /** The floor of the range is what the person is aiming at. */
    salaryTarget: preferences.salary.min,
    noExperience: profile.experienceYears === 0,
    education: profile.education === "" ? null : EDUCATION_RANK[profile.education],
    experienceYears: profile.experienceYears,
  };
}

export const isEmptyRanking = (ranking: Ranking): boolean =>
  ranking.categories.length === 0 &&
  ranking.departments.length === 0 &&
  ranking.modes.length === 0 &&
  ranking.levels.length === 0 &&
  ranking.jobTypes.length === 0 &&
  ranking.salaryTarget === null &&
  !ranking.noExperience &&
  ranking.education === null &&
  ranking.experienceYears === null;

/** What the person has told the app, in plain words, for the sort control. */
export function rankingSummary(ranking: Ranking): string[] {
  const parts: string[] = [];
  if (ranking.categories.length > 0) parts.push("rubros elegidos");
  if (ranking.departments.length > 0) parts.push("zona");
  if (ranking.modes.length > 0) parts.push("modalidad");
  if (ranking.levels.length > 0 || ranking.experienceYears !== null) parts.push("experiencia");
  if (ranking.jobTypes.length > 0) parts.push("jornada");
  if (ranking.salaryTarget !== null) parts.push("sueldo");
  if (ranking.education !== null) parts.push("estudios");
  return parts;
}
