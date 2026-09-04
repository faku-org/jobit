/**
 * Switches for walking through what a first visit sees, read from the address
 * bar. The intro only happens once per browser by design, which makes it the
 * hardest part of the app to look at again: `?dev=onboarding` replays it whole
 * without erasing what this browser already has.
 *
 * They are read on demand and never stored, so a link with one in it changes
 * this load and nothing else.
 */
export interface DevFlags {
  /** Show the onboarding from its first screen, whatever storage says. */
  onboarding: boolean;
}

export const NO_DEV: DevFlags = { onboarding: false };

/** Comma separated, so `?dev=onboarding` today survives a second switch. */
export function readDevFlags(search: string = window.location.search): DevFlags {
  const asked = new URLSearchParams(search)
    .get("dev")
    ?.split(",")
    .map((entry) => entry.trim());

  if (!asked) return NO_DEV;
  return { onboarding: asked.includes("onboarding") || asked.includes("all") };
}
