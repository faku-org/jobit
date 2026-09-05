import type { ReactNode } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { AURA_INTRO_MS, useSettlingBusy } from "../../hooks/useSettlingBusy.ts";

interface AuraProps {
  /** False leaves the block bare: it only wears the aura while what it holds
   * was written by the page. */
  on?: boolean;
  /** True while the answer is still being worked out: the aura speeds up. */
  busy?: boolean;
  /** The rounding, and any tuning of `--aura-tone` or `--aura-base`, since only
   * the caller knows what the block sits on. */
  className?: string;
  /** False skips the opening busy beat, for a result that should arrive calm. */
  intro?: boolean;
  children: ReactNode;
}

/**
 * The mark of something the page worked out on its own: what it read in a CV,
 * how an offer measures against the profile. A gradient of the app's own
 * palette glows from the rim and frosts inward, leaving the centre clear, so
 * an answer nobody typed never passes for one that somebody did.
 *
 * The surface lives on the box itself. What goes inside should be padding and
 * content, no background of its own. The whole effect lives in `.aura`.
 */
export function Aura({
  on = true,
  busy = false,
  intro = true,
  className = "",
  children,
}: AuraProps) {
  const shownBusy = useSettlingBusy(busy, intro ? AURA_INTRO_MS : 0);

  if (!on) return <>{children}</>;

  return (
    <div className={`aura ${shownBusy ? "aura-busy" : ""} ${className}`.trim()}>
      <div aria-hidden className="aura-glass" />
      <div className="aura-body">{children}</div>
    </div>
  );
}

/** The orb that goes with it: breathing when the answer is there, working
 * while it is being worked out, which is the only sign that the wait is doing
 * something. */
export function AuraSpark({
  busy = false,
  tone = "surface",
  state,
  intro = false,
  className = "",
}: {
  busy?: boolean;
  /** The island is navy in both schemes, so the orb has to paint light ink. */
  tone?: "panel" | "surface";
  /** Pins a specific animation; otherwise busy works and idle breathes. */
  state?: OrbState;
  /** True plays a working beat before breathing. Off by default: the
   * canvas remounts on a state change, so a fake intro reads as a jump. */
  intro?: boolean;
  className?: string;
}) {
  const shownBusy = useSettlingBusy(busy, intro ? AURA_INTRO_MS : 0);
  const orbState = state ?? (shownBusy ? "working" : "breathing");

  return (
    <ThinkingOrb
      aria-hidden
      aria-label={shownBusy ? "Pensando" : "Generado por JobIt"}
      className={`aura-spark ${tone === "panel" ? "aura-spark-panel" : ""} shrink-0 ${className}`.trim()}
      size={20}
      state={orbState}
      theme={tone === "panel" ? "dark" : "auto"}
    />
  );
}
