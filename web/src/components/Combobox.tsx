import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDismissable } from "../hooks/useDismissable.ts";
import { type CatalogEntry, groupCatalog, searchCatalog } from "../lib/catalog.ts";
import { fadeUpTransition } from "../lib/motion.ts";

interface ComboboxProps<T extends CatalogEntry> {
  label: string;
  placeholder: string;
  entries: T[];
  /** Ids already picked, in the order they were picked. */
  selected: string[];
  /** Beyond this the list stops being a profile and starts being a résumé. */
  max?: number;
  onChange: (selected: string[]) => void;
}

const DEFAULT_MAX = 20;

/**
 * A closed list with a search box, replacing the free-text field that used to
 * collect títulos and cursos. Typing filters; only what is on the list can be
 * picked, which is the whole point: "bachiller", "Bachillerato" and "bto" were
 * three values the app could do nothing with.
 */
export function Combobox<T extends CatalogEntry>({
  label,
  placeholder,
  entries,
  selected,
  max = DEFAULT_MAX,
  onChange,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const container = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const full = selected.length >= max;

  /** Picked entries drop off the list: they are already shown as chips. The
   * flat position travels with each option so the keyboard can walk the list
   * across its group headings. */
  const { options, groups } = useMemo(() => {
    const chosen = new Set(selected);
    const found = searchCatalog(entries, query).filter((entry) => !chosen.has(entry.id));
    let index = -1;
    const numbered = groupCatalog(found).map(
      ([group, items]) =>
        [group, items.map((entry) => ({ entry, index: ++index }))] as [
          string,
          { entry: T; index: number }[],
        ],
    );
    return { options: found, groups: numbered };
  }, [entries, query, selected]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const pick = (id: string) => {
    if (full || selected.includes(id)) return;
    onChange([...selected, id]);
    setQuery("");
    input.current?.focus();
  };

  const remove = (id: string) => onChange(selected.filter((item) => item !== id));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      return setActive((current) => (current + step + options.length) % options.length);
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) pick(option.id);
      return;
    }

    /** Backspace on an empty box takes back the last pick, as a tag input does. */
    if (event.key === "Backspace" && query === "" && selected.length > 0) {
      const last = selected[selected.length - 1];
      if (last) remove(last);
    }
  };

  return (
    <div ref={container}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          {label}
        </p>
        {selected.length > 0 ? (
          <span className="text-[10px] text-onpanel-faint tabular-nums">
            {selected.length}/{max}
          </span>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const entry = entries.find((item) => item.id === id);
            if (!entry) return null;
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky px-3 py-1.5 text-xs font-medium text-ink"
              >
                <span className="truncate">{entry.label}</span>
                <button
                  aria-label={`Quitar ${entry.label}`}
                  className="shrink-0 rounded-full text-muted transition-colors hover:text-ink"
                  type="button"
                  onClick={() => remove(id)}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="relative mt-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-onpanel-faint"
        />
        <input
          ref={input}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-label={label}
          className="w-full rounded-lg border border-onpanel/20 bg-onpanel/5 py-1.5 pr-8 pl-8 text-xs text-onpanel outline-none transition-colors placeholder:text-onpanel-faint focus:border-sky disabled:opacity-50"
          disabled={full}
          placeholder={full ? `Llegaste al máximo de ${max}` : placeholder}
          role="combobox"
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <ChevronDown
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-onpanel-faint transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* The list sits in flow rather than floating: both sheets that hold a
          Combobox scroll, and an absolutely placed list is clipped by them. */}
      <AnimatePresence>
        {open && !full ? (
          <motion.div
            ref={list}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-onpanel/20 bg-onpanel/5 p-1"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
            role="listbox"
            transition={fadeUpTransition}
          >
            {options.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-[11px] text-onpanel-muted">
                No hay nada con ese nombre en la lista.
              </p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group}>
                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-onpanel-faint uppercase">
                    {group}
                  </p>
                  {items.map(({ entry, index }) => (
                    <button
                      key={entry.id}
                      aria-selected={index === active}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        index === active
                          ? "bg-onpanel/15 text-onpanel"
                          : "text-onpanel/75 hover:bg-onpanel-wash"
                      }`}
                      data-index={index}
                      role="option"
                      type="button"
                      onClick={() => pick(entry.id)}
                      onMouseEnter={() => setActive(index)}
                    >
                      <span className="truncate">{entry.label}</span>
                      {index === active ? (
                        <Check aria-hidden className="size-3 shrink-0 text-sky" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ))
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
