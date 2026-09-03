import { useCallback, useEffect, useState } from "react";
import { isCourseId, isDegreeId } from "../lib/catalog.ts";
import { type CustomFeed, MAX_FEEDS, isFeedUrl } from "../lib/feed.ts";
import {
  EDUCATION_LEVELS,
  EMPTY_PROFILE,
  type EducationLevel,
  type Profile,
} from "../lib/profile.ts";
import {
  type Application,
  type ApplicationStatus,
  EMPTY_PREFERENCES,
  EMPTY_SALARY,
  type Job,
  type JobType,
  type Level,
  type Preferences,
  type SalaryPreference,
  type Theme,
  type WorkMode,
  toApplication,
} from "../lib/types.ts";

const STORAGE_KEY = "jobit.prefs.v1";

interface Stored {
  saved: string[];
  dismissed: string[];
  preferences: Preferences;
  applications: Application[];
  /** Job boards to read from; empty means every source the API offers. */
  sources: string[];
  /** Extra feeds somebody pointed the app at; read in the browser only. */
  feeds: CustomFeed[];
  theme: Theme;
  profile: Profile;
  /** When the anonymous summary was last sent, so it goes at most once a day. */
  statsSentAt: string;
}

const EMPTY: Stored = {
  saved: [],
  dismissed: [],
  preferences: EMPTY_PREFERENCES,
  applications: [],
  sources: [],
  feeds: [],
  theme: "system",
  profile: EMPTY_PROFILE,
  statsSentAt: "",
};

/** Titles and courses are picked from a list, so the cap is a sanity bound. */
const MAX_ENTRIES = 40;
const MAX_SALARY = 1_000_000;
const MAX_EXPERIENCE_YEARS = 60;

const MODES: WorkMode[] = ["onsite", "remote", "hybrid"];
const LEVELS: Level[] = ["entry", "mid", "senior"];
const JOB_TYPES: JobType[] = ["full_time", "part_time", "internship"];
const THEMES: Theme[] = ["light", "dark", "system"];
const STATUSES: ApplicationStatus[] = ["applied", "interview", "closed"];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Ordered lists keep their order and lose their duplicates. */
const unique = (value: unknown, limit = MAX_ENTRIES): string[] => [
  ...new Set(strings(value).slice(0, limit)),
];

const within = <T extends string>(value: unknown, allowed: T[]): T[] => [
  ...new Set(strings(value).filter((item): item is T => (allowed as string[]).includes(item))),
];

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

/** A stored number that has to land inside a range to mean anything. */
function bounded(value: unknown, max: number): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.min(Math.max(Math.round(value), 0), max);
}

function readSalary(value: unknown): SalaryPreference {
  if (typeof value !== "object" || value === null) return EMPTY_SALARY;
  const raw = value as Record<string, unknown>;
  const min = bounded(raw.min, MAX_SALARY);
  const max = bounded(raw.max, MAX_SALARY);

  return {
    min,
    /** An upside-down range would silently match nothing. */
    max: min !== null && max !== null && max < min ? null : max,
    includeUnknown: raw.includeUnknown !== false,
  };
}

/** Nothing can be wanted and hidden at once, whatever the storage says. */
const withoutHidden = (wanted: string[], hidden: string[]): string[] =>
  wanted.filter((value) => !hidden.includes(value));

function readPreferences(value: unknown): Preferences {
  if (typeof value !== "object" || value === null) return EMPTY_PREFERENCES;
  const raw = value as Record<string, unknown>;
  const hiddenCategories = unique(raw.hiddenCategories);
  const hiddenDepartments = unique(raw.hiddenDepartments);

  return {
    modes: within(raw.modes, MODES),
    categories: withoutHidden(unique(raw.categories), hiddenCategories),
    hiddenCategories,
    departments: withoutHidden(unique(raw.departments), hiddenDepartments),
    hiddenDepartments,
    levels: within(raw.levels, LEVELS),
    jobTypes: within(raw.jobTypes, JOB_TYPES),
    noExperience: raw.noExperience === true,
    salary: readSalary(raw.salary),
    rankByFit: raw.rankByFit !== false,
  };
}

/** Entries are catalog ids now; anything else was typed by an older version
 * and cannot be matched against an offer, so it is dropped. */
const catalogIds = (value: unknown, known: (id: string) => boolean): string[] =>
  unique(value).filter(known);

function readProfile(value: unknown): Profile {
  if (typeof value !== "object" || value === null) return EMPTY_PROFILE;
  const raw = value as Record<string, unknown>;

  return {
    education: oneOf<EducationLevel | "">(raw.education, [...EDUCATION_LEVELS, ""], ""),
    degrees: catalogIds(raw.degrees, isDegreeId),
    courses: catalogIds(raw.courses, isCourseId),
    experienceYears: bounded(raw.experienceYears, MAX_EXPERIENCE_YEARS),
    shareStats: raw.shareStats !== false,
    onboardedAt: text(raw.onboardedAt),
  };
}

function readFeeds(value: unknown): CustomFeed[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item): CustomFeed[] => {
      if (typeof item !== "object" || item === null) return [];
      const raw = item as Record<string, unknown>;
      const url = text(raw.url);
      if (typeof raw.id !== "string" || !isFeedUrl(url)) return [];
      return [
        {
          id: raw.id,
          url,
          label: text(raw.label, "Fuente propia").slice(0, 40),
          enabled: raw.enabled !== false,
        },
      ];
    })
    .slice(0, MAX_FEEDS);
}

function readApplications(value: unknown): Application[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): Application[] => {
    if (typeof item !== "object" || item === null) return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string") return [];
    return [
      {
        id: raw.id,
        status: oneOf(raw.status, STATUSES, "applied"),
        appliedAt: text(raw.appliedAt),
        title: text(raw.title, "Oferta"),
        company: typeof raw.company === "string" ? raw.company : null,
        category: text(raw.category),
        categoryLabel: text(raw.categoryLabel, "Sin rubro"),
        source: text(raw.source),
        applyUrl: text(raw.applyUrl),
      },
    ];
  });
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      saved: strings(parsed.saved),
      dismissed: strings(parsed.dismissed),
      preferences: readPreferences(parsed.preferences),
      applications: readApplications(parsed.applications),
      sources: strings(parsed.sources),
      feeds: readFeeds(parsed.feeds),
      theme: oneOf(parsed.theme, THEMES, "system"),
      profile: readProfile(parsed.profile),
      statsSentAt: text(parsed.statsSentAt),
    };
  } catch {
    return EMPTY;
  }
}

const toggle = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

export interface JobPrefs {
  saved: Set<string>;
  dismissed: Set<string>;
  preferences: Preferences;
  applications: Application[];
  appliedIds: Set<string>;
  sources: string[];
  feeds: CustomFeed[];
  theme: Theme;
  profile: Profile;
  statsSentAt: string;
  toggleSaved: (id: string) => void;
  toggleDismissed: (id: string) => void;
  clearDismissed: () => void;
  setPreferences: (preferences: Preferences) => void;
  setSources: (sources: string[]) => void;
  setFeeds: (feeds: CustomFeed[]) => void;
  setTheme: (theme: Theme) => void;
  setProfile: (profile: Profile) => void;
  /** Saves what the onboarding collected in one write, so the list is not
   * refetched once per step of it. */
  completeOnboarding: (profile: Profile, preferences: Preferences) => void;
  /** Clears what decides the order and asks the questions again, leaving the
   * profile and the lists alone. Starting the rerun over the old answers left
   * leftovers in every step that got skipped. */
  restartOnboarding: () => void;
  /** Wipes everything this browser holds and starts over from nothing. */
  eraseEverything: () => void;
  markStatsSent: (at: string) => void;
  /** Records that the person did send the application, keeping a snapshot. */
  addApplication: (job: Job) => void;
  setApplicationStatus: (id: string, status: ApplicationStatus) => void;
  removeApplication: (id: string) => void;
}

/** Shortlist, discard pile, follow-up list and settings, kept in the browser so
 * no account is needed. */
export function useJobPrefs(): JobPrefs {
  /** Read on the first render: coming back through an effect would render the
   * whole list once on the defaults and again on the real state. */
  const [stored, setStored] = useState<Stored>(read);

  useEffect(() => {
    if (stored === EMPTY) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [stored]);

  /**
   * Saving and discarding are opposite answers to the same question, so an
   * offer is never both: shortlisting something takes it out of the discard
   * pile and discarding it takes it off the shortlist.
   */
  const toggleSaved = useCallback((id: string) => {
    setStored((current) => {
      const saved = toggle(current.saved, id);
      return saved.includes(id)
        ? { ...current, saved, dismissed: current.dismissed.filter((item) => item !== id) }
        : { ...current, saved };
    });
  }, []);

  const toggleDismissed = useCallback((id: string) => {
    setStored((current) => {
      const dismissed = toggle(current.dismissed, id);
      return dismissed.includes(id)
        ? { ...current, dismissed, saved: current.saved.filter((item) => item !== id) }
        : { ...current, dismissed };
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setStored((current) => ({ ...current, dismissed: [] }));
  }, []);

  const setPreferences = useCallback((preferences: Preferences) => {
    setStored((current) => ({ ...current, preferences }));
  }, []);

  const setSources = useCallback((sources: string[]) => {
    setStored((current) => ({ ...current, sources }));
  }, []);

  const setFeeds = useCallback((feeds: CustomFeed[]) => {
    setStored((current) => ({ ...current, feeds: feeds.slice(0, MAX_FEEDS) }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setStored((current) => ({ ...current, theme }));
  }, []);

  const setProfile = useCallback((profile: Profile) => {
    setStored((current) => ({ ...current, profile }));
  }, []);

  const completeOnboarding = useCallback((profile: Profile, preferences: Preferences) => {
    setStored((current) => ({
      ...current,
      preferences,
      profile: { ...profile, onboardedAt: new Date().toISOString() },
    }));
  }, []);

  const restartOnboarding = useCallback(() => {
    setStored((current) => ({
      ...current,
      preferences: EMPTY_PREFERENCES,
      sources: [],
      profile: { ...current.profile, onboardedAt: "" },
    }));
  }, []);

  const eraseEverything = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /** A browser that refuses storage has nothing to erase either. */
    }
    /** Not EMPTY itself: that object is the sentinel the writer skips, and the
     * erased state has to be written so a reload does not resurrect the old one. */
    setStored({ ...EMPTY, feeds: [], profile: { ...EMPTY_PROFILE } });
  }, []);

  const markStatsSent = useCallback((at: string) => {
    setStored((current) => ({ ...current, statsSentAt: at }));
  }, []);

  const addApplication = useCallback((job: Job) => {
    setStored((current) =>
      current.applications.some((entry) => entry.id === job.id)
        ? current
        : { ...current, applications: [toApplication(job), ...current.applications] },
    );
  }, []);

  const setApplicationStatus = useCallback((id: string, status: ApplicationStatus) => {
    setStored((current) => ({
      ...current,
      applications: current.applications.map((entry) =>
        entry.id === id ? { ...entry, status } : entry,
      ),
    }));
  }, []);

  const removeApplication = useCallback((id: string) => {
    setStored((current) => ({
      ...current,
      applications: current.applications.filter((entry) => entry.id !== id),
    }));
  }, []);

  return {
    saved: new Set(stored.saved),
    dismissed: new Set(stored.dismissed),
    preferences: stored.preferences,
    applications: stored.applications,
    appliedIds: new Set(stored.applications.map((entry) => entry.id)),
    sources: stored.sources,
    feeds: stored.feeds,
    theme: stored.theme,
    profile: stored.profile,
    statsSentAt: stored.statsSentAt,
    toggleSaved,
    toggleDismissed,
    clearDismissed,
    setPreferences,
    setSources,
    setFeeds,
    setTheme,
    setProfile,
    completeOnboarding,
    restartOnboarding,
    eraseEverything,
    markStatsSent,
    addApplication,
    setApplicationStatus,
    removeApplication,
  };
}
