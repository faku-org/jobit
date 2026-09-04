import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface AuraProps {
  /** False leaves the block bare: it only wears the aura while what it holds
   * was written by the page. */
  on?: boolean;
  /** True while the answer is still being worked out: the aura speeds up. */
  busy?: boolean;
  /** The rounding has to match the box inside, so it comes from the caller. */
  className?: string;
  children: ReactNode;
}

/**
 * The mark of something the page worked out on its own: what it read in a CV,
 * how an offer measures against the profile. A gradient of the app's own
 * palette runs around the block and glows behind it, so an answer nobody typed
 * never passes for one that somebody did.
 *
 * The whole effect lives in `.aura` in index.css; this only names it and keeps
 * the content above the glow.
 */
export function Aura({ on = true, busy = false, className = "", children }: AuraProps) {
  if (!on) return <>{children}</>;

  return (
    <div className={`aura ${busy ? "aura-busy" : ""} ${className}`.trim()}>
      <div>{children}</div>
    </div>
  );
}

/** The icon that goes with it: lit when the answer is there, breathing while it
 * is being worked out, which is the only sign that the wait is doing something. */
export function AuraSpark({
  busy = false,
  className = "",
}: {
  busy?: boolean;
  className?: string;
}) {
  return (
    <Sparkles
      aria-hidden
      className={`aura-spark ${busy ? "aura-spark-busy" : ""} ${className}`.trim()}
    />
  );
}
