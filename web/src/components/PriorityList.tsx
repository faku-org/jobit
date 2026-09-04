import { ArrowDown, ArrowUp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { fadeUpTransition } from "../lib/motion.ts";
import { reorder } from "../lib/types.ts";

interface PriorityListProps {
  title: string;
  /** Values in order of preference, first is the one wanted most. */
  values: string[];
  /** The value's human name; a value with no label is skipped. */
  labelOf: (value: string) => string | undefined;
  empty: string;
  onChange: (values: string[]) => void;
}

/**
 * The ordered half of the preferences: "prefiero administración sobre ventas"
 * is this list with administración above ventas. Order is what the ranking
 * reads, so it has to be visible and movable rather than implied by the
 * order things happened to be clicked in.
 */
export function PriorityList({ title, values, labelOf, empty, onChange }: PriorityListProps) {
  const move = (from: number, to: number) => onChange(reorder(values, from, to));

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>

      {values.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-onpanel-faint">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-1">
          <AnimatePresence initial={false} mode="popLayout">
            {values.map((value, index) => {
              const label = labelOf(value) ?? value;
              return (
                <motion.li
                  key={value}
                  layout
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg bg-onpanel-wash py-1.5 pr-1.5 pl-2.5"
                  exit={{ opacity: 0, y: -6 }}
                  initial={{ opacity: 0, y: 6 }}
                  transition={{ ...fadeUpTransition, layout: fadeUpTransition }}
                >
                  <span className="w-4 shrink-0 text-[11px] font-semibold text-sky tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-onpanel">{label}</span>

                  <button
                    aria-label={`Subir ${label}`}
                    className="shrink-0 rounded-md p-1 text-onpanel-muted transition-colors hover:bg-onpanel/15 hover:text-onpanel disabled:opacity-25 disabled:hover:bg-transparent"
                    disabled={index === 0}
                    type="button"
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp aria-hidden className="size-3.5" />
                  </button>
                  <button
                    aria-label={`Bajar ${label}`}
                    className="shrink-0 rounded-md p-1 text-onpanel-muted transition-colors hover:bg-onpanel/15 hover:text-onpanel disabled:opacity-25 disabled:hover:bg-transparent"
                    disabled={index === values.length - 1}
                    type="button"
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown aria-hidden className="size-3.5" />
                  </button>
                  <button
                    aria-label={`Quitar ${label}`}
                    className="shrink-0 rounded-md p-1 text-onpanel-muted transition-colors hover:bg-onpanel/15 hover:text-onpanel"
                    type="button"
                    onClick={() => onChange(values.filter((item) => item !== value))}
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
