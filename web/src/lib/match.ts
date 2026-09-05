import { assessFit } from "./fit.ts";
import type { Profile } from "./profile.ts";
import type { Ranking } from "./ranking.ts";
import type { Job, Mix, Preferences } from "./types.ts";
import { matchesPreferences, preferenceCount, workMode } from "./types.ts";

const LEVEL_RANK = { entry: 0, mid: 1, senior: 2 } as const;

/** Years of experience folded into the three levels the board uses. */
export function levelFromYears(years: number): keyof typeof LEVEL_RANK {
  if (years <= 1) return "entry";
  if (years <= 4) return "mid";
  return "senior";
}

const CAP: Record<Mix, { fraction: number; max: number; min: number }> = {
  broad: { fraction: 1, max: Number.POSITIVE_INFINITY, min: 0 },
  balanced: { fraction: 0.35, max: 16, min: 4 },
  focused: { fraction: 0.18, max: 8, min: 3 },
};

/** How many of a matching set keep the “Para vos” mark. */
export function highlightCap(matchingCount: number, mix: Mix): number {
  if (matchingCount === 0) return 0;
  const { fraction, max, min } = CAP[mix];
  if (fraction >= 1) return matchingCount;
  return Math.min(max, Math.max(min, Math.round(matchingCount * fraction)));
}

/**
 * How well an offer answers the ranking, without recency. Used to pick the
 * “Para vos” slice among jobs that already pass the boolean preferences.
 */
export function fitScore(job: Job, ranking: Ranking, profile: Profile): number {
  let score = 0;
  const cat = ranking.categories.indexOf(job.category);
  if (cat >= 0) score += (ranking.categories.length - cat) * 10;
  if (job.department) {
    const dep = ranking.departments.indexOf(job.department);
    if (dep >= 0) score += (ranking.departments.length - dep) * 4;
  }
  if (ranking.modes.length > 0 && ranking.modes.includes(workMode(job))) score += 3;
  if (job.level && ranking.levels.includes(job.level)) score += 3;
  if (job.job_type && ranking.jobTypes.includes(job.job_type)) score += 2;

  if (profile.experienceYears !== null && job.level) {
    const have = LEVEL_RANK[levelFromYears(profile.experienceYears)];
    const gap = Math.abs(LEVEL_RANK[job.level] - have);
    score += (2 - gap) * 5;
  }

  return score;
}

/**
 * The jobs that earn the aura. Broad keeps every preference hit; the other
 * two keep a top slice so the mark still means something when a single rubro
 * would otherwise stamp the whole page.
 */
export function pickHighlights(
  jobs: Job[],
  preferences: Preferences,
  ranking: Ranking,
  profile: Profile,
): Set<string> {
  if (preferenceCount(preferences) === 0) return new Set();

  const mix = preferences.mix;
  const candidates = jobs.filter((job) => {
    if (!matchesPreferences(job, preferences)) return false;
    if (mix === "broad") return true;
    return assessFit(job, profile).status !== "short";
  });

  const cap = highlightCap(candidates.length, mix);
  const ranked = [...candidates].sort((a, b) => {
    const diff = fitScore(b, ranking, profile) - fitScore(a, ranking, profile);
    if (diff !== 0) return diff;
    return b.date_posted.localeCompare(a.date_posted);
  });

  return new Set(ranked.slice(0, cap).map((job) => job.id));
}
