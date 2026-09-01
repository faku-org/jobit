import type { Transition } from "motion/react";

/** The one entrance curve used across the app. */
export const fadeUpTransition: Transition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };

export const islandTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

/** Delay for the nth item of a staggered list, capped so long lists stay snappy. */
export const stagger = (index: number, step = 0.045, max = 0.36): number =>
  Math.min(index * step, max);
