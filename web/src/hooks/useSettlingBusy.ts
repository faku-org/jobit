import { useEffect, useRef, useState } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/** Enough of the busy cycle to read as thinking. The aura's busy spin is 2.6s;
 * a finished answer should not land before one pass has been seen. */
export const AURA_BUSY_MIN_MS = 2200;

/** First beat when a result appears already done: the orb works, then breathes. */
export const AURA_INTRO_MS = 1200;

const prefersReduced = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(REDUCED).matches;

export const remainingBusyMs = (started: number, minMs: number): number =>
  prefersReduced() ? 0 : Math.max(0, minMs - (performance.now() - started));

/** Holds the caller until `minMs` have passed since `started`. */
export const holdBusy = (started: number, minMs = AURA_BUSY_MIN_MS): Promise<void> => {
  const wait = remainingBusyMs(started, minMs);
  if (wait === 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, wait);
  });
};

/**
 * Stays true while `busy` is true, and for a little after it drops, so a
 * fast answer does not skip the motion that says something was worked out.
 * On mount, with `intro`, it also plays that beat when the answer is already
 * there.
 */
export function useSettlingBusy(busy: boolean, minMs: number = AURA_INTRO_MS): boolean {
  const [held, setHeld] = useState(() => busy || minMs > 0);
  const started = useRef(performance.now());

  useEffect(() => {
    if (busy) {
      started.current = performance.now();
      setHeld(true);
      return;
    }

    const wait = remainingBusyMs(started.current, minMs);
    if (wait === 0) {
      setHeld(false);
      return;
    }

    const id = window.setTimeout(() => setHeld(false), wait);
    return () => window.clearTimeout(id);
  }, [busy, minMs]);

  return held;
}
