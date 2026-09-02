import { findProfileMatches } from "./perks.ts";
import { EDUCATION_LABEL, type Profile, meetsEducation } from "./profile.ts";
import type { Job } from "./types.ts";

/**
 * Whether the person clears the bar the offer sets. Only the requirements that
 * can actually be checked are checked: an offer asks for a dozen things in
 * prose and the app knows about two of them, so the answer is deliberately
 * narrow and says so.
 */
export type CheckStatus = "ok" | "short" | "unknown";

export interface Check {
  id: string;
  /** What the offer asks for. */
  asks: string;
  /** What the person has, against it. */
  yours: string;
  status: CheckStatus;
}

export interface Fit {
  checks: Check[];
  /** Catalog entries of theirs that the offer names outright. */
  matched: string[];
  /** "short" as soon as one checkable requirement is not met. */
  status: CheckStatus;
  /** True when the profile is too empty for any of this to mean anything. */
  unknownProfile: boolean;
}

function educationCheck(job: Job, profile: Profile): Check | null {
  if (!job.education_level) return null;
  const meets = meetsEducation(job, profile);

  return {
    id: "education",
    asks: job.education_level,
    yours:
      profile.education === ""
        ? "No cargaste tu nivel educativo"
        : EDUCATION_LABEL[profile.education],
    status: meets === null ? "unknown" : meets ? "ok" : "short",
  };
}

const years = (count: number): string => (count === 1 ? "1 año" : `${count} años`);

function experienceCheck(job: Job, profile: Profile): Check | null {
  if (job.no_experience) {
    return {
      id: "experience",
      asks: "No pide experiencia previa",
      yours: profile.experienceYears === null ? "" : `Tenés ${years(profile.experienceYears)}`,
      status: "ok",
    };
  }

  if (job.experience_years_min === null) return null;

  return {
    id: "experience",
    asks: `${years(job.experience_years_min)} de experiencia`,
    yours:
      profile.experienceYears === null
        ? "No cargaste tus años de experiencia"
        : `Tenés ${years(profile.experienceYears)}`,
    status:
      profile.experienceYears === null
        ? "unknown"
        : profile.experienceYears >= job.experience_years_min
          ? "ok"
          : "short",
  };
}

/** The offer's own words, where a requirement can hide outside its own field. */
const requirementText = (job: Job): string => [job.requirements ?? "", job.description].join("\n");

export function assessFit(job: Job, profile: Profile): Fit {
  const checks = [educationCheck(job, profile), experienceCheck(job, profile)].filter(
    (check): check is Check => check !== null,
  );

  const matched = findProfileMatches(requirementText(job), profile);
  const unknownProfile =
    profile.education === "" && profile.experienceYears === null && profile.courses.length === 0;

  const status: CheckStatus = checks.some((check) => check.status === "short")
    ? "short"
    : checks.some((check) => check.status === "ok")
      ? "ok"
      : "unknown";

  return { checks, matched, status, unknownProfile };
}

/** The one line at the top of the sheet, before anything is read in detail. */
export function fitHeadline(fit: Fit): string {
  if (fit.status === "short") return "Te falta algo de lo que pide";
  if (fit.status === "ok") {
    return fit.matched.length > 0
      ? "Cumplís lo que se puede verificar, y pide cosas que tenés"
      : "Cumplís lo que se puede verificar";
  }
  if (fit.matched.length > 0) return "Pide cosas que tenés en tu perfil";
  return "No hay datos para saber si cumplís";
}

/** Whether the sheet has anything worth saying about the fit at all. */
export const hasFit = (fit: Fit): boolean => fit.checks.length > 0 || fit.matched.length > 0;

/** The education gap in plain words, for the one case people ask about most. */
export function educationGap(job: Job, profile: Profile): string | null {
  if (!job.education_level || profile.education === "") return null;
  const meets = meetsEducation(job, profile);
  if (meets !== false) return null;
  return `Pide ${job.education_level.toLowerCase()} y cargaste ${EDUCATION_LABEL[
    profile.education
  ].toLowerCase()}. Igual podés postularte: muchos avisos lo ponen como deseable.`;
}
