import { useCallback, useEffect, useState } from "react";
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
  type Job,
  type JobType,
  type Level,
  type Preferences,
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
  theme: "system",
  profile: EMPTY_PROFILE,
  statsSentAt: "",
};

/** Free text the person types about themselves, kept small on purpose. */
const MAX_ENTRIES = 24;
const MAX_ENTRY_LENGTH = 120;

const MODES: WorkMode[] = ["onsite", "remote", "hybrid"];
const LEVELS: Level[] = ["entry", "mid", "senior"];
const JOB_TYPES: JobType[] = ["full_time", "part_time", "internship"];
const THEMES: Theme[] = ["light", "dark", "system"];
const STATUSES: ApplicationStatus[] = ["applied", "interview", "closed"];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const within = <T extends string>(value: unknown, allowed: T[]): T[] =>
  strings(value).filter((item): item is T => (allowed as string[]).includes(item));

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

function readPreferences(value: unknown): Preferences {
  if (typeof value !== "object" || value === null) return EMPTY_PREFERENCES;
  const raw = value as Record<string, unknown>;
  return {
    modes: within(raw.modes, MODES),
    categories: strings(raw.categories),
    levels: within(raw.levels, LEVELS),
    jobTypes: within(raw.jobTypes, JOB_TYPES),
    noExperience: raw.noExperience === true,
  };
}

function readProfile(value: unknown): Profile {
  if (typeof value !== "object" || value === null) return EMPTY_PROFILE;
  const raw = value as Record<string, unknown>;
  const list = (entries: unknown): string[] =>
    strings(entries)
      .flatMap((entry) => {
        const trimmed = entry.trim().slice(0, MAX_ENTRY_LENGTH);
        return trimmed ? [trimmed] : [];
      })
      .slice(0, MAX_ENTRIES);

  const years = typeof raw.experienceYears === "number" ? raw.experienceYears : null;

  return {
    education: oneOf<EducationLevel | "">(raw.education, [...EDUCATION_LEVELS, ""], ""),
    degrees: list(raw.degrees),
    courses: list(raw.courses),
    experienceYears: years === null || Number.isNaN(years) ? null : Math.max(years, 0),
    shareStats: raw.shareStats !== false,
  };
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
  theme: Theme;
  profile: Profile;
  statsSentAt: string;
  toggleSaved: (id: string) => void;
  toggleDismissed: (id: string) => void;
  clearDismissed: () => void;
  setPreferences: (preferences: Preferences) => void;
  setSources: (sources: string[]) => void;
  setTheme: (theme: Theme) => void;
  setProfile: (profile: Profile) => void;
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

  const toggleSaved = useCallback((id: string) => {
    setStored((current) => ({ ...current, saved: toggle(current.saved, id) }));
  }, []);

  const toggleDismissed = useCallback((id: string) => {
    setStored((current) => ({ ...current, dismissed: toggle(current.dismissed, id) }));
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

  const setTheme = useCallback((theme: Theme) => {
    setStored((current) => ({ ...current, theme }));
  }, []);

  const setProfile = useCallback((profile: Profile) => {
    setStored((current) => ({ ...current, profile }));
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
    theme: stored.theme,
    profile: stored.profile,
    statsSentAt: stored.statsSentAt,
    toggleSaved,
    toggleDismissed,
    clearDismissed,
    setPreferences,
    setSources,
    setTheme,
    setProfile,
    markStatsSent,
    addApplication,
    setApplicationStatus,
    removeApplication,
  };
}
