import { Bookmark, Building2, EyeOff, MapPin, Target, Undo2, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  APPLICATION_STATUS_LABEL,
  SOURCE_LABEL,
  formatDay,
  formatLocation,
} from "../../lib/format.ts";
import { islandTransition } from "../../lib/motion.ts";
import { chipClass, iconButtonClass } from "../../lib/styles.ts";
import { type Application, type Job, type Tag, relatedApplications } from "../../lib/types.ts";
import { ApplyFooter } from "./ApplyFooter.tsx";
import { JobChips, type TagActions } from "./JobChips.tsx";
import { JobDescription } from "./JobDescription.tsx";
import { JobFit } from "./JobFit.tsx";
import { ShareMenu } from "../ui/ShareMenu.tsx";

interface JobModalProps {
  job: Job;
  isSaved: boolean;
  isDismissed: boolean;
  isMatch: boolean;
  isApplied: boolean;
  applications: Application[];
  /** What the chips of the sheet can do to the list behind it. */
  tagActions: TagActions;
  onToggleSaved: (id: string) => void;
  onToggleDismissed: (id: string) => void;
  onApplied: (job: Job) => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ApplicationList({ applications }: { applications: Application[] }) {
  return (
    <ul className="space-y-1.5">
      {applications.map((entry) => (
        <li key={entry.id} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-ink/80">{entry.title}</span>
          <span className="shrink-0 text-xs text-muted">
            {APPLICATION_STATUS_LABEL[entry.status]}
            {entry.appliedAt ? ` · ${formatDay(entry.appliedAt)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The whole offer on one sheet: description, tips written for this offer, and
 * what the person already did with the offers around it.
 */
export function JobModal({
  job,
  isSaved,
  isDismissed,
  isMatch,
  isApplied,
  applications,
  tagActions,
  onToggleSaved,
  onToggleDismissed,
  onApplied,
  onClose,
}: JobModalProps) {
  const related = relatedApplications(job, applications);
  /** The sheet plays its own exit and then asks to be unmounted. */
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);
  /** Filtering by a chip is a jump back to the list, so the sheet steps aside. */
  const chipActions: TagActions = {
    ...tagActions,
    onFilter: (tag: Tag) => {
      tagActions.onFilter(tag);
      close();
    },
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        animate={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        onClick={close}
      />

      <motion.div
        animate={closing ? { opacity: 0, y: 24, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="job-modal-title"
        aria-modal
        className="relative flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:max-h-[85svh] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
        onAnimationComplete={() => {
          if (closing) onClose();
        }}
      >
        <header className="flex items-start gap-3 border-b border-sky/40 px-5 py-4">
          <div className="min-w-0 flex-1">
            {isMatch ? (
              <span className={`${chipClass} mb-2 bg-panel text-onpanel`}>
                <Target aria-hidden className="size-3.5" />
                Para vos
              </span>
            ) : null}
            <h2
              className="text-[19px] leading-snug font-semibold tracking-tight text-ink"
              id="job-modal-title"
            >
              {job.title}
            </h2>
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
            <motion.button
              aria-label="Cerrar"
              className={iconButtonClass}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={close}
            >
              <X aria-hidden className="size-4" />
            </motion.button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <JobChips actions={chipActions} job={job} />

          <JobFit job={job} profile={tagActions.profile} />

          <Section title="Descripción">
            {job.description ? (
              <JobDescription profile={tagActions.profile} text={job.description} />
            ) : (
              <p className="text-sm text-muted">
                Esta oferta todavía no tiene la descripción descargada. Suele aparecer en la próxima
                actualización; mientras tanto podés abrir el aviso original.
              </p>
            )}
          </Section>

          {job.requirements ? (
            <Section title="Requisitos">
              <JobDescription profile={tagActions.profile} text={job.requirements} />
            </Section>
          ) : null}

          {related.company.length > 0 || related.category.length > 0 ? (
            <Section title="Tus postulaciones">
              <div className="space-y-4 rounded-xl border border-sky/50 px-3 py-3">
                {related.company.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Ya te postulaste a {related.company.length}{" "}
                      {related.company.length === 1 ? "puesto" : "puestos"} en {job.company}
                    </p>
                    <div className="mt-2">
                      <ApplicationList applications={related.company} />
                    </div>
                  </div>
                ) : null}

                {related.category.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {related.category.length}{" "}
                      {related.category.length === 1 ? "postulación" : "postulaciones"} en{" "}
                      {job.category_label}
                    </p>
                    <div className="mt-2">
                      <ApplicationList applications={related.category} />
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          <p className="text-xs text-muted">
            Fuente: {SOURCE_LABEL[job.source] ?? job.source}
            {job.vacancies && job.vacancies > 1 ? ` · ${job.vacancies} vacantes` : ""}
            {job.duplicates.length > 0 ? ` · ${job.duplicates.length} publicación repetida` : ""}
          </p>
        </div>

        <div className="border-t border-sky/40 bg-surface px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <ApplyFooter
            isApplied={isApplied}
            job={job}
            left={
              <p className="text-xs text-muted">
                {isApplied
                  ? "Está en tu lista de seguimiento."
                  : "Te pregunto si te postulaste al volver."}
              </p>
            }
            onApplied={onApplied}
          />
        </div>
      </motion.div>
    </div>
  );
}
