import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUpTransition, stagger } from "../lib/motion.ts";
import { type Job, groupByCategory } from "../lib/types.ts";

interface JobListProps {
  jobs: Job[];
  /** Splits the list into one section per rubro, biggest first. */
  byCategory?: boolean;
  renderJob: (job: Job) => ReactNode;
}

/**
 * Entrances and exits only: a `layout` animation here would make the browser
 * measure every card on every change, and the list runs to hundreds of them.
 */
function Item({ index, children }: { index: number; children: ReactNode }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      initial={{ opacity: 0, y: 16 }}
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
      <div className="space-y-3">
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
            <span className="text-xs text-ink/50 tabular-nums">{group.jobs.length}</span>
          </h2>
          <div className="space-y-3">
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
