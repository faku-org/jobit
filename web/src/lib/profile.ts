import { degreeById } from "./catalog.ts";
import { EDUCATION_RANK, type EducationLevel } from "./education.ts";
import type { Job } from "./types.ts";

/** Se re-exportan para que el nivel educativo se siga leyendo desde el perfil,
 * que es donde se usa en la app. */
export {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  EDUCATION_RANK,
  type EducationLevel,
} from "./education.ts";

/**
 * What the person studied. Everything about the profile lives in this file and
 * in the browser: nothing here is ever sent anywhere, and the only thing that
 * leaves is the anonymous summary built in stats.ts.
 */
export interface Profile {
  /** Empty until the person picks one. */
  education: EducationLevel | "";
  /** Ids from the degree catalog, so a título is a value and not free text. */
  degrees: string[];
  /** Ids from the course catalog. */
  courses: string[];
  experienceYears: number | null;
  /** Anonymous usage stats; on unless the person turns it off. */
  shareStats: boolean;
  /** When the onboarding was finished, empty while it has never been run. */
  onboardedAt: string;
}

export const EMPTY_PROFILE: Profile = {
  education: "",
  degrees: [],
  courses: [],
  experienceYears: null,
  shareStats: true,
  onboardedAt: "",
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
  return required === null ? null : EDUCATION_RANK[profile.education] >= required;
}

/**
 * The highest level implied by the títulos picked. Choosing "Licenciatura en
 * Enfermería" and leaving the level on "Primaria" is a contradiction the
 * person should not have to resolve by hand.
 */
export function levelFromDegrees(degrees: string[]): EducationLevel | "" {
  let best: EducationLevel | "" = "";
  for (const id of degrees) {
    const degree = degreeById(id);
    if (!degree) continue;
    if (best === "" || EDUCATION_RANK[degree.level] > EDUCATION_RANK[best]) best = degree.level;
  }
  return best;
}

/** Adds a título and raises the level when the new one goes higher. */
export function withDegrees(profile: Profile, degrees: string[]): Profile {
  const implied = levelFromDegrees(degrees);
  const raise =
    implied !== "" &&
    (profile.education === "" || EDUCATION_RANK[implied] > EDUCATION_RANK[profile.education]);

  return { ...profile, degrees, education: raise ? implied : profile.education };
}

/** Counts what the person filled in, for the badge on the profile tab. */
export const profileCount = (profile: Profile): number =>
  (profile.education === "" ? 0 : 1) +
  profile.degrees.length +
  profile.courses.length +
  (profile.experienceYears === null ? 0 : 1);

export const isOnboarded = (profile: Profile): boolean => profile.onboardedAt !== "";
