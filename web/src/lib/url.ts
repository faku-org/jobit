import {
  EMPTY_FILTERS,
  type Filters,
  type JobType,
  type Level,
  type View,
  type WorkMode,
} from "./types.ts";

/**
 * The part of the screen that belongs in the address bar, so the link the
 * person copies lands on what they were looking at instead of on the board
 * from scratch.
 *
 * What depends on the reader's own browser stays out: "solo similares" reads
 * preferences that live in the other person's storage, and the rubro chips
 * over the saved list are about a list only its owner has. Both would mean
 * something different on the other side, or nothing at all.
 */
export interface ViewState {
  view: View;
  filters: Filters;
}

const VIEWS: View[] = ["all", "saved", "tracking", "state", "market"];
const LEVELS: Level[] = ["entry", "mid", "senior"];
const MODES: WorkMode[] = ["onsite", "remote", "hybrid"];
const JOB_TYPES: JobType[] = ["full_time", "part_time", "internship"];

/** The names the API already takes, so the project keeps one vocabulary. */
const PARAM = {
  view: "view",
  q: "q",
  category: "category",
  department: "department",
  level: "level",
  mode: "remote",
  jobType: "job_type",
  noExperience: "no_experience",
  days: "days",
} as const;

const MAX_QUERY = 200;

/** Anything outside the union reads as "not set": a hand-edited or truncated
 * link should still open the board rather than ask the API for nonsense. */
const oneOf = <T extends string>(raw: string | null, allowed: T[]): T | "" =>
  allowed.find((value) => value === raw) ?? "";

const positiveInteger = (raw: string | null): number | null => {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
};

export function readViewState(search: string = window.location.search): ViewState {
  const params = new URLSearchParams(search);

  return {
    view: VIEWS.find((value) => value === params.get(PARAM.view)) ?? "all",
    filters: {
      ...EMPTY_FILTERS,
      q: params.get(PARAM.q)?.slice(0, MAX_QUERY) ?? "",
      category: params.get(PARAM.category) ?? "",
      department: params.get(PARAM.department) ?? "",
      level: oneOf(params.get(PARAM.level), LEVELS),
      mode: oneOf(params.get(PARAM.mode), MODES),
      jobType: oneOf(params.get(PARAM.jobType), JOB_TYPES),
      noExperience: params.get(PARAM.noExperience) === "true",
      days: positiveInteger(params.get(PARAM.days)),
    },
  };
}

/**
 * Writes the state over whatever else the address bar carries: it only ever
 * touches its own parameters, so the `?job=` a shared link came with survives
 * a change of tab.
 *
 * A tab is a place the back button should return to, so it is pushed. A filter
 * is not: pushing those would turn every letter typed into the search box into
 * a step of the history to walk back out of.
 */
export function writeViewState(state: ViewState, push: boolean): void {
  const url = new URL(window.location.href);
  const { view, filters } = state;

  const set = (name: string, value: string): void => {
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  };

  set(PARAM.view, view === "all" ? "" : view);
  set(PARAM.q, filters.q.trim());
  set(PARAM.category, filters.category);
  set(PARAM.department, filters.department);
  set(PARAM.level, filters.level);
  set(PARAM.mode, filters.mode);
  set(PARAM.jobType, filters.jobType);
  set(PARAM.noExperience, filters.noExperience ? "true" : "");
  set(PARAM.days, filters.days === null ? "" : String(filters.days));

  const next = url.toString();
  if (next === window.location.href) return;
  if (push) window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}
