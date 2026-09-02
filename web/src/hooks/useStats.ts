import { useEffect, useRef } from "react";
import { sendStats } from "../lib/api.ts";
import type { Profile } from "../lib/profile.ts";
import { type Usage, anonymousStats } from "../lib/stats.ts";

const DAY_MS = 86_400_000;

/**
 * Sends the anonymous summary once a day at most, and only while the person
 * leaves the switch on. A failure is swallowed: no statistic is worth an error
 * in front of someone looking for work.
 */
export function useStats(
  profile: Profile,
  usage: Usage,
  sentAt: string,
  onSent: (at: string) => void,
): void {
  const latest = useRef({ profile, usage, onSent });
  const done = useRef(false);

  useEffect(() => {
    latest.current = { profile, usage, onSent };
  });

  useEffect(() => {
    if (done.current || !profile.shareStats) return;

    const last = Date.parse(sentAt);
    if (!Number.isNaN(last) && Date.now() - last < DAY_MS) return;

    done.current = true;
    const at = new Date().toISOString();

    sendStats(anonymousStats(latest.current.profile, latest.current.usage))
      .then(() => latest.current.onSent(at))
      .catch(() => {
        done.current = false;
      });
  }, [profile.shareStats, sentAt]);
}
