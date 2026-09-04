import { motion } from "motion/react";
import type { CategoryGroup } from "../lib/types.ts";

interface CategoryChipsProps {
  groups: CategoryGroup[];
  /** Empty means every rubro. */
  selected: string;
  onSelect: (value: string) => void;
}

const chip =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";

/** Rubro filter for the saved list, counted over what is actually saved. */
export function CategoryChips({ groups, selected, onSelect }: CategoryChipsProps) {
  if (groups.length < 2) return null;

  const total = groups.reduce((sum, group) => sum + group.jobs.length, 0);
  const options = [{ value: "", label: "Todos", count: total }].concat(
    groups.map((group) => ({ value: group.value, label: group.label, count: group.jobs.length })),
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <motion.button
          key={option.value}
          aria-pressed={selected === option.value}
          className={`${chip} ${
            selected === option.value
              ? "border-panel bg-panel text-onpanel"
              : "border-sky/60 bg-surface text-muted hover:border-brand hover:text-ink"
          }`}
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
          <span className="tabular-nums opacity-60">{option.count}</span>
        </motion.button>
      ))}
    </div>
  );
}
