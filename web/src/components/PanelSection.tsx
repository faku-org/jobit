import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUpTransition } from "../lib/motion.ts";

interface PanelSectionProps {
  title: string;
  /** What is set inside, shown while it is closed so nothing hides silently. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * One theme of the preferences panel, closed until it is asked for. Ten groups
 * in a row read as a form nobody finishes; three headers read as a choice of
 * where to go, and the summary is what makes a closed one honest about holding
 * something.
 */
export function PanelSection({ title, summary, open, onToggle, children }: PanelSectionProps) {
  return (
    <div className="border-t border-onpanel/10 pt-3 first:border-t-0 first:pt-0">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-onpanel/5"
        type="button"
        onClick={onToggle}
      >
        <ChevronDown
          aria-hidden
          className={`size-3.5 shrink-0 text-onpanel/50 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <span className="text-[11px] font-semibold tracking-wide text-onpanel/60 uppercase">
          {title}
        </span>
        {!open && summary !== "" ? (
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-onpanel/45">
            {summary}
          </span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={fadeUpTransition}
          >
            <div className="space-y-5 px-1 pt-3 pb-1">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
