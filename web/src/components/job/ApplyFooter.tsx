import { ArrowUpRight, CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { applyEvent } from "../../lib/events.ts";
import { fadeUpTransition } from "../../lib/motion.ts";
import { chipClass } from "../../lib/styles.ts";
import { track } from "../../lib/track.ts";
import type { Job } from "../../lib/types.ts";

interface ApplyFooterProps {
  job: Job;
  isApplied: boolean;
  onApplied: (job: Job) => void;
  /** Slot for whatever the host wants on the left of the row. */
  left?: ReactNode;
}

const answerClass = "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors";

/**
 * Opens the offer on the job board and, back in the tab, asks whether the
 * application was actually sent: only a yes puts it on the follow-up list.
 */
export function ApplyFooter({ job, isApplied, onApplied, left }: ApplyFooterProps) {
  const [asking, setAsking] = useState(false);

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {asking && !isApplied ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={fadeUpTransition}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/50 bg-mist px-3 py-2.5">
              <p className="text-xs text-soft">¿Te postulaste finalmente?</p>
              <div className="flex gap-1.5">
                <button
                  className={`${answerClass} bg-panel text-onpanel hover:bg-brand`}
                  type="button"
                  onClick={() => {
                    onApplied(job);
                    setAsking(false);
                  }}
                >
                  Sí, seguir esta
                </button>
                <button
                  className={`${answerClass} text-muted hover:bg-sky/25 hover:text-ink`}
                  type="button"
                  onClick={() => setAsking(false)}
                >
                  Todavía no
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {left ?? <span />}

        <div className="ml-auto flex items-center gap-2">
          {isApplied ? (
            <span className={`${chipClass} bg-brand/15 text-ink`}>
              <CheckCheck aria-hidden className="size-3.5" />
              En seguimiento
            </span>
          ) : null}

          <motion.a
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel transition-colors hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none"
            href={job.apply_url}
            rel="noreferrer noopener"
            target="_blank"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              track(applyEvent(job));
              setAsking(!isApplied);
            }}
          >
            {isApplied ? "Ver el aviso" : "Postularme"}
            <ArrowUpRight aria-hidden className="size-4" />
          </motion.a>
        </div>
      </div>
    </div>
  );
}
