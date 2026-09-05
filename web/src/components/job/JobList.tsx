import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUpTransition, stagger } from "../../lib/motion.ts";
import { type Job, groupByCategory } from "../../lib/types.ts";

interface JobListProps {
  jobs: Job[];
  /** Splits the list into one section per rubro, biggest first. */
  byCategory?: boolean;
  renderJob: (job: Job) => ReactNode;
}

/** Las que alguien llega a ver entrar. Cambiar de pestaña con cincuenta
 * tarjetas animando de las dos puntas es trabajo que se paga en cuadros y que
 * nadie mira: abajo de la primera pantalla la tarjeta aparece y ya está. */
const ANIMATED = 12;

/** `translateY(0)` still creates a stacking context and would trap the
 * match-card bloom inside this wrapper, painting it over the card above. */
function restTransform({
  y,
  scale,
}: {
  y?: string | number;
  scale?: string | number;
}): string {
  const ty = typeof y === "number" ? y : Number.parseFloat(String(y ?? 0)) || 0;
  const s = typeof scale === "number" ? scale : Number.parseFloat(String(scale ?? 1)) || 1;
  if (!ty && s === 1) return "none";
  const parts: string[] = [];
  if (ty) parts.push(`translateY(${ty}px)`);
  if (s !== 1) parts.push(`scale(${s})`);
  return parts.join(" ");
}

function Item({ index, children }: { index: number; children: ReactNode }) {
  if (index >= ANIMATED) return <div>{children}</div>;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      initial={{ opacity: 0, y: 16 }}
      transformTemplate={restTransform}
      transition={{ ...fadeUpTransition, delay: stagger(index) }}
    >
      {children}
    </motion.div>
  );
}

/** The animated list of offers, flat or split by rubro. */
export function JobList({ jobs, byCategory = false, renderJob }: JobListProps) {
  if (!byCategory) {
    return (
      <div className="isolate space-y-3">
        <AnimatePresence initial={false}>
          {jobs.map((job, index) => (
            <Item key={job.id} index={index}>
              {renderJob(job)}
            </Item>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupByCategory(jobs).map((group) => (
        <section key={group.value}>
          <h2 className="mb-3 flex items-baseline gap-2 px-1">
            <span className="text-sm font-semibold tracking-tight text-ink">{group.label}</span>
            <span className="text-xs text-muted tabular-nums">{group.jobs.length}</span>
          </h2>
          <div className="isolate space-y-3">
            <AnimatePresence initial={false}>
              {group.jobs.map((job, index) => (
                <Item key={job.id} index={index}>
                  {renderJob(job)}
                </Item>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
