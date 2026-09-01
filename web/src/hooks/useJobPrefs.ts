import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_PREFERENCES,
  type JobType,
  type Level,
  type Preferences,
  type WorkMode,
} from "../lib/types.ts";

const STORAGE_KEY = "jobit.prefs.v1";

interface Stored {
  saved: string[];
  dismissed: string[];
  preferences: Preferences;
}

const EMPTY: Stored = { saved: [], dismissed: [], preferences: EMPTY_PREFERENCES };

const MODES: WorkMode[] = ["onsite", "remote", "hybrid"];
const LEVELS: Level[] = ["entry", "mid", "senior"];
const JOB_TYPES: JobType[] = ["full_time", "part_time", "internship"];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const within = <T extends string>(value: unknown, allowed: T[]): T[] =>
  strings(value).filter((item): item is T => (allowed as string[]).includes(item));

function readPreferences(value: unknown): Preferences {
  if (typeof value !== "object" || value === null) return EMPTY_PREFERENCES;
  const raw = value as Record<string, unknown>;
  return {
    modes: within(raw.modes, MODES),
    categories: strings(raw.categories),
    levels: within(raw.levels, LEVELS),
    jobTypes: within(raw.jobTypes, JOB_TYPES),
  };
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
  toggleSaved: (id: string) => void;
  toggleDismissed: (id: string) => void;
  clearDismissed: () => void;
  setPreferences: (preferences: Preferences) => void;
}

/** Shortlist, discard pile and search preferences, kept in the browser so no
 * account is needed. */
export function useJobPrefs(): JobPrefs {
  const [stored, setStored] = useState<Stored>(EMPTY);

  useEffect(() => setStored(read()), []);

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

  return {
    saved: new Set(stored.saved),
    dismissed: new Set(stored.dismissed),
    preferences: stored.preferences,
    toggleSaved,
    toggleDismissed,
    clearDismissed,
    setPreferences,
  };
}
