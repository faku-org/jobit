import { ArrowUpRight, ClipboardList, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { APPLICATION_STATUS_LABEL, formatDay } from "../lib/format.ts";
import { fadeUpTransition, stagger } from "../lib/motion.ts";
import type { Application, ApplicationStatus } from "../lib/types.ts";

interface TrackingProps {
  applications: Application[];
  onSetStatus: (id: string, status: ApplicationStatus) => void;
  onRemove: (id: string) => void;
}

const STATUSES: ApplicationStatus[] = ["applied", "interview", "closed"];

function StatusPicker({
  status,
  onSetStatus,
}: {
  status: ApplicationStatus;
  onSetStatus: (status: ApplicationStatus) => void;
}) {
  return (
    <div className="flex gap-1">
      {STATUSES.map((option) => (
        <button
          key={option}
          aria-pressed={status === option}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            status === option
              ? "bg-panel text-onpanel"
              : "bg-mist text-ink/60 hover:bg-sky/40 hover:text-ink"
          }`}
          type="button"
          onClick={() => onSetStatus(option)}
        >
          {APPLICATION_STATUS_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

/** The offers the person confirmed they applied to, grouped by how each one is
 * going. Everything shown here is the snapshot taken when they applied. */
export function Tracking({ applications, onSetStatus, onRemove }: TrackingProps) {
  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sky bg-surface/60 px-6 py-16 text-center">
        <ClipboardList aria-hidden className="mx-auto size-7 text-brand" />
        <p className="mt-4 text-[15px] font-medium text-ink">
          Todavía no seguís ninguna postulación
        </p>
        <p className="mt-1 text-sm text-ink/60">
          Cuando le des a “Postularme” te pregunto si finalmente mandaste el CV, y la oferta aparece
          acá.
        </p>
      </div>
    );
  }

  const groups = STATUSES.map((status) => ({
    status,
    entries: applications.filter((entry) => entry.status === status),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.status}>
          <h2 className="mb-3 flex items-baseline gap-2 px-1">
            <span className="text-sm font-semibold tracking-tight text-ink">
              {APPLICATION_STATUS_LABEL[group.status]}
            </span>
            <span className="text-xs text-ink/50 tabular-nums">{group.entries.length}</span>
          </h2>

          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {group.entries.map((entry, index) => (
                <motion.article
                  key={entry.id}
                  layout
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-sky/50 bg-surface p-4"
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  initial={{ opacity: 0, y: 16 }}
                  transition={{
                    ...fadeUpTransition,
                    delay: stagger(index),
                    layout: fadeUpTransition,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] leading-snug font-medium text-ink">
                        {entry.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-ink/60">
                        {[entry.company, entry.categoryLabel].filter(Boolean).join(" · ")}
                        {entry.appliedAt ? ` · postulado el ${formatDay(entry.appliedAt)}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      {entry.applyUrl ? (
                        <a
                          aria-label="Abrir el aviso"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-mist hover:text-ink"
                          href={entry.applyUrl}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          <ArrowUpRight aria-hidden className="size-4" />
                        </a>
                      ) : null}
                      <button
                        aria-label="Quitar del seguimiento"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-ink/40 transition-colors hover:bg-mist hover:text-ink"
                        type="button"
                        onClick={() => onRemove(entry.id)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <StatusPicker
                      status={entry.status}
                      onSetStatus={(status) => onSetStatus(entry.id, status)}
                    />
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
