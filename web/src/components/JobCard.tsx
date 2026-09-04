import { Bookmark, Building2, EyeOff, MapPin, Target, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { fadeUpTransition } from "../lib/motion.ts";
import { formatLocation } from "../lib/format.ts";
import { chipClass, iconButtonClass } from "../lib/styles.ts";
import type { Job } from "../lib/types.ts";
import { ApplyFooter } from "./ApplyFooter.tsx";
import { JobChips, type TagActions } from "./JobChips.tsx";
import { ShareMenu } from "./ShareMenu.tsx";

interface JobCardProps {
  job: Job;
  isSaved: boolean;
  isDismissed: boolean;
  /** Matches the saved preferences, so it gets pulled forward visually. */
  isMatch: boolean;
  isApplied: boolean;
  /** What the chips of this card can do to the list. */
  tagActions: TagActions;
  onOpen: (job: Job) => void;
  onToggleSaved: (id: string) => void;
  onToggleDismissed: (id: string) => void;
  onApplied: (job: Job) => void;
}

/** Off-screen cards are skipped by the browser until they scroll close, which
 * is what keeps a list of hundreds cheap to lay out. */
const cardShell =
  "rounded-2xl border bg-surface p-5 transition-[border-color,box-shadow,opacity] [contain-intrinsic-size:auto_260px] [content-visibility:auto]";

function cardClass(isDismissed: boolean, isMatch: boolean): string {
  if (isDismissed) return "border-sky/40 opacity-55";
  if (isMatch) return "border-brand ring-2 ring-brand/25 shadow-[var(--shadow-match)]";
  return "border-sky/50 hover:border-brand hover:shadow-[var(--shadow-card)]";
}

export function JobCard({
  job,
  isSaved,
  isDismissed,
  isMatch,
  isApplied,
  tagActions,
  onOpen,
  onToggleSaved,
  onToggleDismissed,
  onApplied,
}: JobCardProps) {
  return (
    <article className={`${cardShell} ${cardClass(isDismissed, isMatch)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {isMatch && !isDismissed ? (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className={`${chipClass} mb-2 bg-panel text-onpanel`}
              initial={{ opacity: 0, y: -4 }}
              transition={fadeUpTransition}
            >
              <Target aria-hidden className="size-3.5" />
              Para vos
            </motion.span>
          ) : null}
          <h2 className="text-[17px] leading-snug font-medium tracking-tight text-ink">
            <button
              className="text-left transition-colors hover:text-brand"
              type="button"
              onClick={() => onOpen(job)}
            >
              {job.title}
            </button>
          </h2>
        </div>

        <div className="flex shrink-0 gap-1.5">
          <ShareMenu job={job} />
          <motion.button
            aria-label={isSaved ? "Quitar de guardadas" : "Guardar oferta"}
            aria-pressed={isSaved}
            className={`${iconButtonClass} ${
              isSaved ? "border-panel bg-panel text-onpanel hover:text-onpanel" : ""
            }`}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleSaved(job.id)}
          >
            <Bookmark aria-hidden className={`size-4 ${isSaved ? "fill-current" : ""}`} />
          </motion.button>
          <motion.button
            aria-label={isDismissed ? "Recuperar oferta" : "Descartar oferta"}
            className={iconButtonClass}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleDismissed(job.id)}
          >
            {isDismissed ? (
              <Undo2 aria-hidden className="size-4" />
            ) : (
              <EyeOff aria-hidden className="size-4" />
            )}
          </motion.button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-soft">
        {job.company ? (
          <span className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden className="size-3.5 shrink-0 text-brand" />
            {job.company}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-brand" />
          {formatLocation(job.city, job.department)}
        </span>
      </div>

      <div className="mt-4">
        <JobChips actions={tagActions} job={job} />
      </div>

      <div className="mt-4">
        <ApplyFooter
          isApplied={isApplied}
          job={job}
          left={
            <button
              className="-mx-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:text-ink sm:mx-0 sm:min-h-0 sm:px-1"
              type="button"
              onClick={() => onOpen(job)}
            >
              Ver descripción y tips
            </button>
          }
          onApplied={onApplied}
        />
      </div>
    </article>
  );
}
