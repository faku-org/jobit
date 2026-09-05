import { useCallback, useState } from "react";

export type SectionId = "search" | "work" | "sources" | "advanced";

/** Kept apart from the preferences: this is where the panel was left, not
 * something the person answered, and it must not travel in the stats payload. */
const STORAGE_KEY = "jobit.sections.v1";

/** The first one open is the one everybody comes for; the rest wait to be
 * asked. */
const CLOSED: Record<SectionId, boolean> = {
  search: true,
  work: false,
  sources: false,
  advanced: false,
};

function read(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return CLOSED;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return CLOSED;
    const stored = parsed as Record<string, unknown>;
    return {
      search: typeof stored.search === "boolean" ? stored.search : CLOSED.search,
      work: typeof stored.work === "boolean" ? stored.work : CLOSED.work,
      sources: typeof stored.sources === "boolean" ? stored.sources : CLOSED.sources,
      advanced: typeof stored.advanced === "boolean" ? stored.advanced : CLOSED.advanced,
    };
  } catch {
    return CLOSED;
  }
}

/**
 * Which sections of the preferences panel are open, remembered across visits.
 * Reopening the panel and finding the section you just filled in collapsed
 * reads as having lost the answers, so this outlives the panel itself.
 */
export function useSections(): [Record<SectionId, boolean>, (id: SectionId) => void] {
  const [open, setOpen] = useState(read);

  const toggle = useCallback((id: SectionId) => {
    setOpen((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /** A browser that refuses storage still gets the toggle, just not the
         * memory of it. */
      }
      return next;
    });
  }, []);

  return [open, toggle];
}
