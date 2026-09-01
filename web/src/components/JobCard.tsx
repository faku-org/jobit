import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarClock,
  ChevronDown,
  Clock3,
  EyeOff,
  GraduationCap,
  Laptop,
  MapPin,
  Sparkles,
  Tag,
  Target,
  Undo2,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { fadeUpTransition } from "../lib/motion.ts";
import {
  JOB_TYPE_LABEL,
  LEVEL_LABEL,
  SOURCE_LABEL,
  WORK_MODE_LABEL,
  formatLocation,
  formatSalary,
  relativeDate,
} from "../lib/format.ts";
import { type Job, workMode } from "../lib/types.ts";

interface JobCardProps {
  job: Job;
  isSaved: boolean;
  isDismissed: boolean;
  /** Matches the saved preferences, so it gets pulled forward visually. */
  isMatch: boolean;
  onToggleSaved: (id: string) => void;
  onToggleDismissed: (id: string) => void;
}

const chipClass = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
const mutedChip = `${chipClass} bg-mist text-ink/70`;
const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-xl border border-sky/60 text-ink/50 transition-colors hover:border-brand hover:text-ink";

function cardClass(isDismissed: boolean, isMatch: boolean): string {
  if (isDismissed) return "border-sky/40 opacity-55";
  if (isMatch) {
    return "border-brand ring-2 ring-brand/25 shadow-[0_4px_20px_rgba(33,150,243,0.14)]";
  }
  return "border-sky/50 hover:border-brand hover:shadow-[0_2px_10px_rgba(13,71,161,0.08)]";
}

export function JobCard({
  job,
  isSaved,
  isDismissed,
  isMatch,
  onToggleSaved,
  onToggleDismissed,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const salary = formatSalary(job.salary);
  const mode = workMode(job);

  return (
    <article
      className={`rounded-2xl border bg-white p-5 transition-all ${cardClass(isDismissed, isMatch)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {isMatch && !isDismissed ? (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className={`${chipClass} mb-2 bg-ink text-white`}
              initial={{ opacity: 0, y: -4 }}
              transition={fadeUpTransition}
            >
              <Target aria-hidden className="size-3.5" />
              Para vos
            </motion.span>
          ) : null}
          <h2 className="text-[17px] leading-snug font-medium tracking-tight text-ink">
            {job.title}
          </h2>
        </div>

        <div className="flex shrink-0 gap-1.5">
          <motion.button
            aria-label={isSaved ? "Quitar de guardadas" : "Guardar oferta"}
            aria-pressed={isSaved}
            className={`${iconButtonClass} ${isSaved ? "border-ink bg-ink text-white hover:text-white" : ""}`}
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

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/70">
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={mutedChip}>
          <Clock3 aria-hidden className="size-3.5" />
          {relativeDate(job.date_posted)}
        </span>

        <span className={mutedChip}>
          <Tag aria-hidden className="size-3.5" />
          {job.category_label}
        </span>

        {job.no_experience ? (
          <span className={`${chipClass} bg-sky/40 text-ink`}>
            <Sparkles aria-hidden className="size-3.5" />
            Sin experiencia
          </span>
        ) : null}

        {job.job_type ? <span className={mutedChip}>{JOB_TYPE_LABEL[job.job_type]}</span> : null}

        <span
          className={`${chipClass} ${job.remote ? "bg-brand/15 text-ink" : "bg-mist text-ink/70"}`}
        >
          <Laptop aria-hidden className="size-3.5" />
          {WORK_MODE_LABEL[mode]}
        </span>

        {job.level ? <span className={mutedChip}>{LEVEL_LABEL[job.level]}</span> : null}

        {salary ? (
          <span className={`${chipClass} bg-ink/10 text-ink`}>
            <Wallet aria-hidden className="size-3.5" />
            {salary}
          </span>
        ) : null}

        {job.education_level ? (
          <span className={mutedChip}>
            <GraduationCap aria-hidden className="size-3.5" />
            {job.education_level}
          </span>
        ) : null}

        {job.schedule ? (
          <span className={mutedChip}>
            <CalendarClock aria-hidden className="size-3.5" />
            {job.schedule}
          </span>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={fadeUpTransition}
          >
            <div className="mt-4 space-y-3 border-t border-sky/40 pt-4 text-sm leading-relaxed text-ink/80">
              {job.description ? (
                <p className="whitespace-pre-line">{job.description}</p>
              ) : (
                <p className="text-ink/50">
                  Esta oferta todavía no tiene la descripción descargada.
                </p>
              )}

              {job.requirements ? (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-ink/50 uppercase">
                    Requisitos
                  </p>
                  <p className="mt-1 whitespace-pre-line">{job.requirements}</p>
                </div>
              ) : null}

              <p className="text-xs text-ink/50">
                Fuente: {SOURCE_LABEL[job.source] ?? job.source}
                {job.vacancies && job.vacancies > 1 ? ` · ${job.vacancies} vacantes` : ""}
                {job.duplicates.length > 0
                  ? ` · ${job.duplicates.length} publicación repetida`
                  : ""}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-ink/50 transition-colors hover:text-ink"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown
            aria-hidden
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Ocultar descripción" : "Ver descripción"}
        </button>

        <motion.a
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-ink px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none"
          href={job.apply_url}
          rel="noreferrer noopener"
          target="_blank"
          whileTap={{ scale: 0.97 }}
        >
          Postularme
          <ArrowUpRight aria-hidden className="size-4" />
        </motion.a>
      </div>
    </article>
  );
}
