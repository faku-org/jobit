import { ArrowUpRight, ClipboardList, Loader2, Maximize2, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { APPLICATION_STATUS_LABEL, formatDay } from "../lib/format.ts";
import { fadeUpTransition, stagger } from "../lib/motion.ts";
import type { Application, ApplicationStatus } from "../lib/types.ts";

interface TrackingProps {
  applications: Application[];
  /** The entry whose offer is being fetched, so the row can say so. */
  openingId: string | null;
  /** Offers that are no longer published, so the row stops offering to open. */
  goneIds: Set<string>;
  onOpen: (application: Application) => void;
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
              : "bg-mist text-muted hover:bg-sky/40 hover:text-ink"
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

/**
 * The offers the person confirmed they applied to, grouped by how each one is
 * going. This is the list after the decision; "Guardadas" is the one before it.
 *
 * Everything shown is the snapshot taken at the moment of applying, so the list
 * survives the offer leaving the board. The full offer is fetched on demand
 * when a row is opened, and rows whose offer is gone say so instead.
 */
export function Tracking({
  applications,
  openingId,
  goneIds,
  onOpen,
  onSetStatus,
  onRemove,
}: TrackingProps) {
  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sky bg-surface/60 px-6 py-16 text-center">
        <ClipboardList aria-hidden className="mx-auto size-7 text-brand" />
        <p className="mt-4 text-[15px] font-medium text-ink">
          Todavía no seguís ninguna postulación
        </p>
        <p className="mt-1 text-sm text-muted">
          Cuando le des a “Postularme” te pregunto si finalmente mandaste el CV, y la oferta aparece
          acá.
        </p>
        <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-muted">
          <strong className="font-medium text-soft">Guardadas</strong> son las que estás pensando;
          <strong className="font-medium text-soft"> Seguimiento</strong> son las que ya mandaste,
          con el estado de cada una. Una oferta pasa sola de una lista a la otra cuando te postulás.
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
            <span className="text-xs text-muted tabular-nums">{group.entries.length}</span>
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
                        {goneIds.has(entry.id) ? (
                          entry.title
                        ) : (
                          <button
                            className="text-left transition-colors hover:text-brand"
                            type="button"
                            onClick={() => onOpen(entry)}
                          >
                            {entry.title}
                          </button>
                        )}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[entry.company, entry.categoryLabel].filter(Boolean).join(" · ")}
                        {entry.appliedAt ? ` · postulado el ${formatDay(entry.appliedAt)}` : ""}
                      </p>
                      {goneIds.has(entry.id) ? (
                        <p className="mt-1 text-[11px] text-faint">
                          El aviso ya no está publicado. Queda acá lo que guardamos cuando te
                          postulaste.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      {goneIds.has(entry.id) ? null : (
                        <button
                          aria-label="Ver la oferta completa"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink"
                          disabled={openingId === entry.id}
                          type="button"
                          onClick={() => onOpen(entry)}
                        >
                          {openingId === entry.id ? (
                            <Loader2 aria-hidden className="size-4 animate-spin" />
                          ) : (
                            <Maximize2 aria-hidden className="size-4" />
                          )}
                        </button>
                      )}
                      {entry.applyUrl ? (
                        <a
                          aria-label="Abrir el aviso"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink"
                          href={entry.applyUrl}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          <ArrowUpRight aria-hidden className="size-4" />
                        </a>
                      ) : null}
                      <button
                        aria-label="Quitar del seguimiento"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-mist hover:text-ink"
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
