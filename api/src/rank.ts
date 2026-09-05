import type { Job, JobType, Level, WorkMode } from "./types.ts";

const DAY_MS = 86_400_000;

/**
 * What the person is after, ordered where order means something. The lists are
 * preferences and not filters: nothing is discarded for missing one, offers
 * that satisfy more of them simply come first. Filtering out is the job of the
 * exclusions in JobsQuery.
 */
export interface Ranking {
  /** Rubros most wanted first: "prefiero X sobre Y" is this list's order. */
  categories: string[];
  /** Departments most wanted first. */
  departments: string[];
  modes: WorkMode[];
  levels: Level[];
  jobTypes: JobType[];
  /** Monthly pay aimed at, in UYU. */
  salaryTarget: number | null;
  noExperience: boolean;
  /** Education held, on the 0-6 scale the web app uses. */
  education: number | null;
  experienceYears: number | null;
  /** How hard fit outweighs recency. Missing reads as balanced. */
  mix: Mix;
}

export type Mix = "broad" | "balanced" | "focused";

export const MIXES: Mix[] = ["broad", "balanced", "focused"];

export const isMix = (value: unknown): value is Mix =>
  typeof value === "string" && (MIXES as readonly string[]).includes(value);

export const EMPTY_RANKING: Ranking = {
  categories: [],
  departments: [],
  modes: [],
  levels: [],
  jobTypes: [],
  salaryTarget: null,
  noExperience: false,
  education: null,
  experienceYears: null,
  mix: "balanced",
};

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

/**
 * How much each dimension can add. They are relative to each other and to
 * nothing else: the number a job ends up with only means something next to
 * another job's.
 */
const WEIGHT = {
  category: 42,
  department: 18,
  mode: 14,
  level: 10,
  jobType: 10,
  salary: 18,
  noExperience: 12,
  education: 10,
  experience: 9,
  recency: 8,
  closing: 6,
} as const;

/** Mismatches cost less than matches pay, so a near miss still beats noise. */
const PENALTY = {
  education: 16,
  experience: 12,
} as const;

/** Recency vs fit. Balanced is the historical weights (scale 1). */
const MIX_SCALE: Record<Mix, { fit: number; recency: number }> = {
  focused: { fit: 1.2, recency: 0.4 },
  balanced: { fit: 1, recency: 1 },
  broad: { fit: 0.4, recency: 2.4 },
};

/** First place is worth the full weight, last place a fraction of it. */
function positionWeight(index: number, length: number): number {
  if (index < 0) return 0;
  return (length - index) / length;
}

const inList = <T extends string>(list: T[], value: T | null): number =>
  value !== null && list.includes(value) ? 1 : 0;

/** How well the pay covers the target: full credit at the target, none at half. */
function salaryFit(job: Job, target: number): number {
  const offered = job.salary?.max ?? job.salary?.min ?? null;
  if (offered === null || offered <= 0) return 0;
  if (offered >= target) return 1;
  return Math.max((offered - target / 2) / (target / 2), 0);
}

const EDUCATION_RULES: [RegExp, number][] = [
  [/posgrado|maestr[ií]a|doctorad/i, 6],
  [/universitari|licenciad|t[ií]tulo de grado|ingenier/i, 5],
  [/terciari|t[eé]cnic|tecnicatura|utu/i, 4],
  [/bachiller|secundaria completa/i, 3],
  [/ciclo b[aá]sico/i, 2],
  [/primaria/i, 1],
];

/** The level an offer asks for, read from the text each source writes freely. */
export function requiredEducation(requirement: string | null): number | null {
  if (!requirement) return null;
  const rule = EDUCATION_RULES.find(([pattern]) => pattern.test(requirement));
  return rule ? rule[1] : null;
}

/** Meeting what is asked pays; being asked for more than you have costs. */
function educationScore(job: Job, held: number): number {
  const required = requiredEducation(job.education_level);
  if (required === null) return 0;
  return required <= held ? WEIGHT.education : -PENALTY.education;
}

function experienceScore(job: Job, years: number): number {
  if (job.no_experience) return WEIGHT.experience;
  if (job.experience_years_min === null) return 0;
  return job.experience_years_min <= years ? WEIGHT.experience : -PENALTY.experience;
}

/** A fresh offer edges out an identical older one; the bonus dies after a month. */
function recencyScore(job: Job, now: number): number {
  const posted = Date.parse(job.date_posted);
  if (Number.isNaN(posted)) return 0;
  const days = (now - posted) / DAY_MS;
  return WEIGHT.recency * Math.max(1 - days / 30, 0);
}

/** A deadline about to pass is worth surfacing while it can still be met. */
function closingScore(job: Job, now: number): number {
  if (!job.closes_at) return 0;
  const closes = Date.parse(job.closes_at);
  if (Number.isNaN(closes)) return 0;
  const days = (closes - now) / DAY_MS;
  if (days < 0) return -WEIGHT.closing;
  return WEIGHT.closing * Math.max(1 - days / 14, 0);
}

/**
 * How well one offer answers what the person said they want. Every term is
 * additive and independent, which is what keeps the result explainable: a card
 * can say "coincide en rubro y modalidad" by asking the same questions.
 */
export function scoreJob(job: Job, ranking: Ranking, now: number = Date.now()): number {
  const scale = MIX_SCALE[ranking.mix];
  let fit = 0;

  fit +=
    WEIGHT.category *
    positionWeight(ranking.categories.indexOf(job.category), ranking.categories.length);

  if (job.department) {
    fit +=
      WEIGHT.department *
      positionWeight(ranking.departments.indexOf(job.department), ranking.departments.length);
  }

  fit += WEIGHT.mode * inList(ranking.modes, job.remote ?? "onsite");
  fit += WEIGHT.level * inList(ranking.levels, job.level);
  fit += WEIGHT.jobType * inList(ranking.jobTypes, job.job_type);

  if (ranking.salaryTarget !== null) {
    fit += WEIGHT.salary * salaryFit(job, ranking.salaryTarget);
  }
  if (ranking.noExperience && job.no_experience) fit += WEIGHT.noExperience;
  if (ranking.education !== null) fit += educationScore(job, ranking.education);
  if (ranking.experienceYears !== null) fit += experienceScore(job, ranking.experienceYears);

  return fit * scale.fit + (recencyScore(job, now) + closingScore(job, now)) * scale.recency;
}
