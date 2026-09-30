import type { Transition } from "motion/react";

/** The one entrance curve used across the app. */
export const fadeUpTransition: Transition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };

export const islandTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

/**
 * Enter/exit that opens a slot without tweening height.
 *
 * Animating height forces layout every frame. A 0fr→1fr grid clips the same
 * way, siblings still reflow, and text is not scaled. Put it on a `grid
 * overflow-hidden` node whose child is `min-h-0 overflow-hidden`. MotionConfig
 * already drops the movement when the OS asks for reduced motion.
 */
export const revealPresence = {
  initial: { gridTemplateRows: "0fr", opacity: 0 },
  animate: { gridTemplateRows: "1fr", opacity: 1 },
  exit: { gridTemplateRows: "0fr", opacity: 0 },
} as const;

/** Delay for the nth item of a staggered list, capped so long lists stay snappy. */
export const stagger = (index: number, step = 0.045, max = 0.36): number =>
  Math.min(index * step, max);
