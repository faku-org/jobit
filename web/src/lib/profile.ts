import type { Job } from "./types.ts";

/**
 * What the person studied. Everything about the profile lives in this file and
 * in the browser: nothing here is ever sent anywhere, and the only thing that
 * leaves is the anonymous summary built in stats.ts.
 */
export type EducationLevel =
  | "none"
  | "primary"
  | "secondary_basic"
  | "secondary"
  | "technical"
  | "university"
  | "postgrad";

export interface Profile {
  /** Empty until the person picks one. */
  education: EducationLevel | "";
  /** Degrees held, free text. Never leaves the browser. */
  degrees: string[];
  /** Courses taken, free text. Never leaves the browser. */
  courses: string[];
  experienceYears: number | null;
  /** Anonymous usage stats; on unless the person turns it off. */
  shareStats: boolean;
}

export const EMPTY_PROFILE: Profile = {
  education: "",
  degrees: [],
  courses: [],
  experienceYears: null,
  shareStats: true,
};

export const EDUCATION_LEVELS: EducationLevel[] = [
  "none",
  "primary",
  "secondary_basic",
  "secondary",
  "technical",
  "university",
  "postgrad",
];

export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  none: "Sin estudios formales",
  primary: "Primaria",
  secondary_basic: "Ciclo básico",
  secondary: "Bachillerato",
  technical: "Técnico o terciario",
  university: "Universitario",
  postgrad: "Posgrado",
};

const RANK: Record<EducationLevel, number> = {
  none: 0,
  primary: 1,
  secondary_basic: 2,
  secondary: 3,
  technical: 4,
  university: 5,
  postgrad: 6,
};

/** Each source writes the requirement its own way, so it is read as text. */
const JOB_EDUCATION_RULES: [RegExp, number][] = [
  [/posgrado|maestr[ií]a|doctorad/i, 6],
  [/universitari|licenciad|t[ií]tulo de grado|ingenier/i, 5],
  [/terciari|t[eé]cnic|tecnicatura|utu/i, 4],
  [/bachiller|secundaria completa/i, 3],
  [/ciclo b[aá]sico/i, 2],
  [/primaria/i, 1],
];

function jobEducationRank(requirement: string): number | null {
  const rule = JOB_EDUCATION_RULES.find(([pattern]) => pattern.test(requirement));
  return rule ? rule[1] : null;
}

/**
 * Whether what the person studied covers what the offer asks for. Null when
 * either side is unknown, so the UI can stay quiet instead of guessing.
 */
export function meetsEducation(job: Job, profile: Profile): boolean | null {
  if (!job.education_level || profile.education === "") return null;
  const required = jobEducationRank(job.education_level);
  return required === null ? null : RANK[profile.education] >= required;
}

/** Counts what the person filled in, for the badge on the profile tab. */
export const profileCount = (profile: Profile): number =>
  (profile.education === "" ? 0 : 1) +
  profile.degrees.length +
  profile.courses.length +
  (profile.experienceYears === null ? 0 : 1);
