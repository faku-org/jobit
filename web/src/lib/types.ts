export type Level = "entry" | "mid" | "senior";
export type Remote = "remote" | "hybrid";
export type JobType = "full_time" | "part_time" | "internship";

/** Remote is null on offers that are worked from the employer's site. */
export type WorkMode = Remote | "onsite";

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface DuplicateRef {
  source: string;
  apply_url: string;
}

export interface Job {
  id: string;
  source: string;
  source_id: string;
  title: string;
  company: string | null;
  department: string | null;
  city: string | null;
  category: string;
  category_label: string;
  date_posted: string;
  level: Level | null;
  remote: Remote | null;
  job_type: JobType | null;
  salary: Salary | null;
  experience_years_min: number | null;
  no_experience: boolean;
  education_level: string | null;
  schedule: string | null;
  vacancies: number | null;
  /** Deadline to apply, only published by the public-sector source. */
  closes_at: string | null;
  description: string;
  requirements: string | null;
  apply_url: string;
  duplicates: DuplicateRef[];
}

export interface JobsResponse {
  total: number;
  offset: number;
  limit: number;
  jobs: Job[];
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface Meta {
  count: number;
  scraped_at: string;
  sources: string[];
  categories: Facet[];
  departments: Facet[];
  no_experience_count: number;
}

/** Colour scheme; "system" follows the OS setting. */
export type Theme = "light" | "dark" | "system";

export type ApplicationStatus = "applied" | "interview" | "closed";

/**
 * An offer the person told us they actually applied to. The job fields are a
 * snapshot: the follow-up list has to survive the offer leaving the feed.
 */
export interface Application {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  title: string;
  company: string | null;
  category: string;
  categoryLabel: string;
  source: string;
  applyUrl: string;
}

export const toApplication = (job: Job, at: string = new Date().toISOString()): Application => ({
  id: job.id,
  status: "applied",
  appliedAt: at,
  title: job.title,
  company: job.company,
  category: job.category,
  categoryLabel: job.category_label,
  source: job.source,
  applyUrl: job.apply_url,
});

/**
 * Applications the person already sent that say something about this offer:
 * same employer first, same rubro second.
 */
export interface RelatedApplications {
  company: Application[];
  category: Application[];
}

const sameCompany = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

export function relatedApplications(job: Job, applications: Application[]): RelatedApplications {
  const others = applications.filter((entry) => entry.id !== job.id);
  const company = others.filter((entry) => sameCompany(entry.company, job.company));
  const inCompany = new Set(company.map((entry) => entry.id));

  return {
    company,
    category: others.filter((entry) => entry.category === job.category && !inCompany.has(entry.id)),
  };
}

/** The lists the main area can show. */
export type View = "all" | "saved" | "tracking" | "state" | "market";

/** How the feed is ordered: newest, best fit, or nearest deadline. */
export type Sort = "recent" | "match" | "closing";

/** The job board that publishes the public-sector calls. */
export const STATE_SOURCE = "uruguayconcursa";

export interface Filters {
  q: string;
  category: string;
  department: string;
  level: Level | "";
  mode: WorkMode | "";
  jobType: JobType | "";
  noExperience: boolean;
  days: number | null;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  category: "",
  department: "",
  level: "",
  mode: "",
  jobType: "",
  noExperience: false,
  days: null,
};

export const hasActiveFilters = (filters: Filters): boolean =>
  filters.q !== "" ||
  filters.category !== "" ||
  filters.department !== "" ||
  filters.level !== "" ||
  filters.mode !== "" ||
  filters.jobType !== "" ||
  filters.noExperience ||
  filters.days !== null;

/** A monthly pay range in pesos; null on an end means it is not bounded. */
export interface SalaryPreference {
  min: number | null;
  max: number | null;
  /** Most offers publish no pay: this says whether they stay in the list. */
  includeUnknown: boolean;
}

export const EMPTY_SALARY: SalaryPreference = { min: null, max: null, includeUnknown: true };

export const hasSalaryPreference = (salary: SalaryPreference): boolean =>
  salary.min !== null || salary.max !== null || !salary.includeUnknown;

/**
 * What the person is looking for, as opposed to the one-off filters above.
 * The lists are ordered where order says something: "prefiero X sobre Y" is
 * the position of X and Y inside `categories`. An empty dimension means "no
 * preference"; a job is similar when it satisfies every dimension that was set.
 *
 * The two `hidden` lists are the only part that removes offers on its own.
 * Everything else reorders, which is what keeps a narrow preference from
 * emptying the board.
 */
export interface Preferences {
  modes: WorkMode[];
  /** Rubros wanted, most wanted first. */
  categories: string[];
  /** Rubros the person never wants to see. */
  hiddenCategories: string[];
  /** Departamentos wanted, most wanted first. */
  departments: string[];
  hiddenDepartments: string[];
  levels: Level[];
  jobTypes: JobType[];
  salary: SalaryPreference;
  /** Order the feed by fit instead of by date. */
  rankByFit: boolean;
  /** How tightly “Para vos” and the match sort follow the profile. */
  mix: Mix;
}

/** broad = every preference hit; focused = a short list of the best hits. */
export type Mix = "broad" | "balanced" | "focused";

export const MIXES: Mix[] = ["broad", "balanced", "focused"];

export const isMix = (value: unknown): value is Mix =>
  typeof value === "string" && (MIXES as readonly string[]).includes(value);

export const EMPTY_PREFERENCES: Preferences = {
  modes: [],
  categories: [],
  hiddenCategories: [],
  departments: [],
  hiddenDepartments: [],
  levels: [],
  jobTypes: [],
  salary: EMPTY_SALARY,
  rankByFit: true,
  mix: "balanced",
};

/** Adds or removes a value from one of the preference lists. */
export const toggleValue = <T extends string>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export const workMode = (job: Job): WorkMode => job.remote ?? "onsite";

/** Offers sharing a rubro, used by the saved view. */
export interface CategoryGroup {
  value: string;
  label: string;
  jobs: Job[];
}

/** Groups a list by rubro, biggest group first. */
export function groupByCategory(jobs: Job[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();

  for (const job of jobs) {
    const group = groups.get(job.category);
    if (group) group.jobs.push(job);
    else groups.set(job.category, { value: job.category, label: job.category_label, jobs: [job] });
  }

  return [...groups.values()].sort(
    (a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label),
  );
}

/** What the person told the app they want, for the badge on the island. */
export const preferenceCount = (preferences: Preferences): number =>
  preferences.modes.length +
  preferences.categories.length +
  preferences.departments.length +
  preferences.levels.length +
  preferences.jobTypes.length +
  (hasSalaryPreference(preferences.salary) ? 1 : 0);

/** What the person told the app to keep out; counted apart, it reads as a
 * different kind of setting and it is the only one that removes offers. */
export const hiddenCount = (preferences: Preferences): number =>
  preferences.hiddenCategories.length + preferences.hiddenDepartments.length;

/** Moves an entry of an ordered preference list one place up or down. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return list;
  next.splice(to, 0, moved);
  return next;
}

export function matchesPreferences(job: Job, preferences: Preferences): boolean {
  const { modes, categories, levels, jobTypes } = preferences;
  if (modes.length > 0 && !modes.includes(workMode(job))) return false;
  if (categories.length > 0 && !categories.includes(job.category)) return false;
  if (levels.length > 0 && (job.level === null || !levels.includes(job.level))) return false;
  if (jobTypes.length > 0 && (job.job_type === null || !jobTypes.includes(job.job_type))) {
    return false;
  }
  return true;
}

/** The dimensions a job chip can act on. */
export type TagDimension = "category" | "level" | "mode" | "jobType" | "noExperience";

/** A chip on a job card, tied to the filter and preference dimension behind it. */
export interface Tag {
  dimension: TagDimension;
  /** Unused by the boolean dimensions. */
  value: string;
  label: string;
}

/** Every dimension but one can be starred. Wanting the offers that ask for no
 * experience is what the profile already says with "ninguna", so that chip
 * filters and nothing more. */
export const canPrefer = (tag: Tag): boolean => tag.dimension !== "noExperience";

export function isPreferredTag(tag: Tag, preferences: Preferences): boolean {
  switch (tag.dimension) {
    case "category":
      return preferences.categories.includes(tag.value);
    case "level":
      return preferences.levels.includes(tag.value as Level);
    case "mode":
      return preferences.modes.includes(tag.value as WorkMode);
    case "jobType":
      return preferences.jobTypes.includes(tag.value as JobType);
    case "noExperience":
      return false;
  }
}

/** Starring a chip: the tag joins the preferences and starts pulling matching
 * offers forward. */
export function togglePreferredTag(preferences: Preferences, tag: Tag): Preferences {
  switch (tag.dimension) {
    case "category":
      return { ...preferences, categories: toggleValue(preferences.categories, tag.value) };
    case "level":
      return { ...preferences, levels: toggleValue(preferences.levels, tag.value as Level) };
    case "mode":
      return { ...preferences, modes: toggleValue(preferences.modes, tag.value as WorkMode) };
    case "jobType":
      return { ...preferences, jobTypes: toggleValue(preferences.jobTypes, tag.value as JobType) };
    case "noExperience":
      return preferences;
  }
}

/** Clicking through a chip: the list narrows to offers carrying that tag. */
export function applyTagToFilters(filters: Filters, tag: Tag): Filters {
  switch (tag.dimension) {
    case "category":
      return { ...filters, category: tag.value };
    case "level":
      return { ...filters, level: tag.value as Level };
    case "mode":
      return { ...filters, mode: tag.value as WorkMode };
    case "jobType":
      return { ...filters, jobType: tag.value as JobType };
    case "noExperience":
      return { ...filters, noExperience: true };
  }
}

/**
 * Where one rubro or departamento stands with the person. The three are
 * exclusive by construction: wanting something removes it from the hidden
 * list and the other way round, so the two lists can never disagree.
 */
export type Stance = "wanted" | "neutral" | "hidden";

export interface StanceLists {
  wanted: string[];
  hidden: string[];
}

export const stanceOf = ({ wanted, hidden }: StanceLists, value: string): Stance =>
  hidden.includes(value) ? "hidden" : wanted.includes(value) ? "wanted" : "neutral";

export function setStance(lists: StanceLists, value: string, stance: Stance): StanceLists {
  const wanted = lists.wanted.filter((item) => item !== value);
  const hidden = lists.hidden.filter((item) => item !== value);

  if (stance === "wanted") return { wanted: [...wanted, value], hidden };
  if (stance === "hidden") return { wanted, hidden: [...hidden, value] };
  return { wanted, hidden };
}

/** Cycles a chip: neutral to wanted, wanted to hidden, hidden back to neutral. */
export const nextStance = (stance: Stance): Stance =>
  stance === "neutral" ? "wanted" : stance === "wanted" ? "hidden" : "neutral";

export const categoryStances = (preferences: Preferences): StanceLists => ({
  wanted: preferences.categories,
  hidden: preferences.hiddenCategories,
});

export const departmentStances = (preferences: Preferences): StanceLists => ({
  wanted: preferences.departments,
  hidden: preferences.hiddenDepartments,
});

export const withCategoryStances = (
  preferences: Preferences,
  { wanted, hidden }: StanceLists,
): Preferences => ({ ...preferences, categories: wanted, hiddenCategories: hidden });

export const withDepartmentStances = (
  preferences: Preferences,
  { wanted, hidden }: StanceLists,
): Preferences => ({ ...preferences, departments: wanted, hiddenDepartments: hidden });

/**
 * Whether an offer satisfies the one-off filters. The API answers this for the
 * board it holds; offers that arrive from somewhere else — a feed the person
 * added — are checked here, against the same filters, so both lists narrow
 * together.
 */
export function matchesFilters(job: Job, filters: Filters): boolean {
  if (filters.category && job.category !== filters.category) return false;
  if (filters.department && job.department !== filters.department) return false;
  if (filters.level && job.level !== filters.level) return false;
  if (filters.mode && workMode(job) !== filters.mode) return false;
  if (filters.jobType && job.job_type !== filters.jobType) return false;
  if (filters.noExperience && !job.no_experience) return false;

  if (filters.days !== null) {
    const posted = Date.parse(job.date_posted);
    if (Number.isNaN(posted) || Date.now() - posted > filters.days * 86_400_000) return false;
  }

  const needle = filters.q.trim();
  if (needle) {
    const haystack = [job.title, job.company ?? "", job.city ?? "", job.description]
      .join(" ")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    const terms = needle
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }

  return true;
}
