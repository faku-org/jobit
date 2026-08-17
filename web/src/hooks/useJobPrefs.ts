import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "jobit.prefs.v1";

interface Prefs {
  saved: string[];
  dismissed: string[];
}

const EMPTY: Prefs = { saved: [], dismissed: [] };

function read(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
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
  toggleSaved: (id: string) => void;
  toggleDismissed: (id: string) => void;
  clearDismissed: () => void;
}

/** Shortlist and discard pile, kept in the browser so no account is needed. */
export function useJobPrefs(): JobPrefs {
  const [prefs, setPrefs] = useState<Prefs>(EMPTY);

  useEffect(() => setPrefs(read()), []);

  useEffect(() => {
    if (prefs === EMPTY) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const toggleSaved = useCallback((id: string) => {
    setPrefs((current) => ({ ...current, saved: toggle(current.saved, id) }));
  }, []);

  const toggleDismissed = useCallback((id: string) => {
    setPrefs((current) => ({ ...current, dismissed: toggle(current.dismissed, id) }));
  }, []);

  const clearDismissed = useCallback(() => {
    setPrefs((current) => ({ ...current, dismissed: [] }));
  }, []);

  return {
    saved: new Set(prefs.saved),
    dismissed: new Set(prefs.dismissed),
    toggleSaved,
    toggleDismissed,
    clearDismissed,
  };
}
