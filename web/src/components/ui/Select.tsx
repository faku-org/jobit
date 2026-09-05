import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useDismissable } from "../../hooks/useDismissable.ts";
import { fadeUpTransition } from "../../lib/motion.ts";
import { fieldClass, popoverClass } from "../../lib/styles.ts";

export interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

/**
 * A listbox that replaces the native select: same keyboard handling, but the
 * options are ours to style, so they follow the theme instead of the OS.
 */
export function Select({ label, value, options, onChange }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const container = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      return setActive((current) => (current + step + options.length) % options.length);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      return open ? choose(active) : openList();
    }

    if (!open) return;
    if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    }
  };

  return (
    <div ref={container} className="relative">
      <button
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={`${fieldClass} flex items-center py-2.5 pr-9 pl-3.5 text-left ${
          open ? "border-brand ring-4 ring-brand/15" : ""
        }`}
        role="combobox"
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`truncate ${value === "" ? "text-muted" : ""}`}>{selected?.label}</span>
        <ChevronDown
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={list}
            animate={{ opacity: 1, y: 0 }}
            aria-label={label}
            className={`${popoverClass} top-full left-0 mt-1 max-h-64 w-max min-w-full max-w-[min(20rem,80vw)] overflow-y-auto`}
            exit={{ opacity: 0, y: -4 }}
            id={`${id}-list`}
            initial={{ opacity: 0, y: -4 }}
            role="listbox"
            transition={fadeUpTransition}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                aria-selected={option.value === value}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  index === active ? "bg-mist text-ink" : "text-soft"
                }`}
                id={`${id}-${index}`}
                role="option"
                onClick={() => choose(index)}
                onMouseEnter={() => setActive(index)}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value ? (
                  <Check aria-hidden className="size-3.5 shrink-0 text-brand" />
                ) : null}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
