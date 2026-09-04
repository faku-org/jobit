import { TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUpTransition } from "../lib/motion.ts";

interface ConfirmProps {
  open: boolean;
  title: string;
  /** What is about to change, spelled out before the second click. */
  losing: ReactNode;
  action: string;
  tone: "warn" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Two steps, always. The first click says what exactly is going to happen and
 * the second one does it: these are the only buttons in the app that throw
 * something away, and there is no server-side copy to restore from.
 */
export function Confirm({ open, title, losing, action, tone, onCancel, onConfirm }: ConfirmProps) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={fadeUpTransition}
        >
          <div className="mt-2 rounded-xl border border-onpanel/20 bg-onpanel-wash px-3 py-3">
            <p className="flex gap-2 text-[11px] leading-relaxed font-medium text-onpanel">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
              {title}
            </p>
            <div className="mt-2 pl-5.5 text-[11px] leading-relaxed text-onpanel/70">{losing}</div>

            <div className="mt-3 flex gap-2 pl-5.5">
              <button
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  tone === "danger"
                    ? "bg-onpanel text-panel hover:bg-onpanel/85"
                    : "bg-sky text-ink hover:bg-sky/85"
                }`}
                type="button"
                onClick={onConfirm}
              >
                {action}
              </button>
              <button
                className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-onpanel/60 transition-colors hover:bg-onpanel-wash hover:text-onpanel"
                type="button"
                onClick={onCancel}
              >
                Cancelar
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
