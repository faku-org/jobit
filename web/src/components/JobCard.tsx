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
  Undo2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import {
  JOB_TYPE_LABEL,
  LEVEL_LABEL,
  REMOTE_LABEL,
  SOURCE_LABEL,
  formatLocation,
  formatSalary,
  relativeDate,
} from "../lib/format.ts";
import type { Job } from "../lib/types.ts";

interface JobCardProps {
  job: Job;
  isSaved: boolean;
  isDismissed: boolean;
  onToggleSaved: (id: string) => void;
  onToggleDismissed: (id: string) => void;
}

const chipClass = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900";

export function JobCard({
  job,
  isSaved,
  isDismissed,
  onToggleSaved,
  onToggleDismissed,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const salary = formatSalary(job.salary);

  return (
    <article
      className={`rounded-2xl border bg-white p-5 transition-all ${
        isDismissed
          ? "border-neutral-200 opacity-55"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] leading-snug font-medium tracking-tight text-neutral-900">
          {job.title}
        </h2>

        <div className="flex shrink-0 gap-1.5">
          <button
            aria-label={isSaved ? "Quitar de guardadas" : "Guardar oferta"}
            aria-pressed={isSaved}
            className={`${iconButtonClass} ${isSaved ? "border-neutral-900 bg-neutral-900 text-white hover:text-white" : ""}`}
            type="button"
            onClick={() => onToggleSaved(job.id)}
          >
            <Bookmark aria-hidden className={`size-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
          <button
            aria-label={isDismissed ? "Recuperar oferta" : "Descartar oferta"}
            className={iconButtonClass}
            type="button"
            onClick={() => onToggleDismissed(job.id)}
          >
            {isDismissed ? (
              <Undo2 aria-hidden className="size-4" />
            ) : (
              <EyeOff aria-hidden className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
        {job.company ? (
          <span className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden className="size-3.5 shrink-0 text-neutral-400" />
            {job.company}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-neutral-400" />
          {formatLocation(job.city, job.department)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`${chipClass} bg-neutral-100 text-neutral-600`}>
          <Clock3 aria-hidden className="size-3.5" />
          {relativeDate(job.date_posted)}
        </span>

        <span className={`${chipClass} bg-neutral-100 text-neutral-700`}>
          <Tag aria-hidden className="size-3.5" />
          {job.category_label}
        </span>

        {job.no_experience ? (
          <span className={`${chipClass} bg-emerald-50 text-emerald-700`}>
            <Sparkles aria-hidden className="size-3.5" />
            Sin experiencia
          </span>
        ) : null}

        {job.job_type ? (
          <span className={`${chipClass} bg-neutral-100 text-neutral-700`}>
            {JOB_TYPE_LABEL[job.job_type]}
          </span>
        ) : null}

        {job.remote ? (
          <span
            className={`${chipClass} ${
              job.remote === "remote" ? "bg-sky-50 text-sky-700" : "bg-indigo-50 text-indigo-700"
            }`}
          >
            <Laptop aria-hidden className="size-3.5" />
            {REMOTE_LABEL[job.remote]}
          </span>
        ) : null}

        {job.level ? (
          <span className={`${chipClass} bg-neutral-100 text-neutral-700`}>
            {LEVEL_LABEL[job.level]}
          </span>
        ) : null}

        {salary ? (
          <span className={`${chipClass} bg-amber-50 text-amber-800`}>
            <Wallet aria-hidden className="size-3.5" />
            {salary}
          </span>
        ) : null}

        {job.education_level ? (
          <span className={`${chipClass} bg-neutral-100 text-neutral-700`}>
            <GraduationCap aria-hidden className="size-3.5" />
            {job.education_level}
          </span>
        ) : null}

        {job.schedule ? (
          <span className={`${chipClass} bg-neutral-100 text-neutral-600`}>
            <CalendarClock aria-hidden className="size-3.5" />
            {job.schedule}
          </span>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4 text-sm leading-relaxed text-neutral-700">
          {job.description ? (
            <p className="whitespace-pre-line">{job.description}</p>
          ) : (
            <p className="text-neutral-500">
              Esta oferta todavía no tiene la descripción descargada.
            </p>
          )}

          {job.requirements ? (
            <div>
              <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                Requisitos
              </p>
              <p className="mt-1 whitespace-pre-line">{job.requirements}</p>
            </div>
          ) : null}

          <p className="text-xs text-neutral-500">
            Fuente: {SOURCE_LABEL[job.source] ?? job.source}
            {job.vacancies && job.vacancies > 1 ? ` · ${job.vacancies} vacantes` : ""}
            {job.duplicates.length > 0 ? ` · ${job.duplicates.length} publicación repetida` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown
            aria-hidden
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Ocultar descripción" : "Ver descripción"}
        </button>

        <a
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus:ring-4 focus:ring-neutral-900/10 focus:outline-none"
          href={job.apply_url}
          rel="noreferrer noopener"
          target="_blank"
        >
          Postularme
          <ArrowUpRight aria-hidden className="size-4" />
        </a>
      </div>
    </article>
  );
}
