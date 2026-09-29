import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryByIso, flagOf, type Country } from "../lib/countries.ts";

/** Sin acentos y en minúsculas: quien escribe "peru" tiene que encontrar "Perú". */
const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function matches(country: Country, needle: string): boolean {
  if (!needle) return true;
  return fold(country.name).includes(needle) || country.dial.startsWith(needle);
}

/**
 * Teléfono con selector de país. El país elige el prefijo, así que nadie tiene
 * que escribirlo a mano; y además del menú con banderas se puede escribir para
 * filtrar: "argentina" deja Argentina primera, con su prefijo listo para elegir.
 */
export function PhoneField({
  iso,
  national,
  onIso,
  onNational,
  error,
}: {
  iso: string;
  national: string;
  onIso: (iso: string) => void;
  onNational: (national: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const country = countryByIso(iso) ?? COUNTRIES[0]!;

  const needle = fold(query.trim());
  const options = useMemo(() => COUNTRIES.filter((entry) => matches(entry, needle)), [needle]);

  /** El resaltado no puede quedar apuntando a una fila que el filtro se llevó. */
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(options.length - 1, 0)));
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (option: Country) => {
    onIso(option.iso);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    /** Con texto escrito, Enter se lleva el resaltado —o el primero, que es lo
     * que se espera al teclear un país y no querer bajar con la flecha. */
    if (event.key === "Enter" && options.length > 0) {
      event.preventDefault();
      choose(options[Math.min(active, options.length - 1)] ?? options[0]!);
    }
  };

  return (
    <div>
      <div className="mt-1.5 flex gap-2" ref={menu}>
        <div className="relative">
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="País del teléfono"
            className="flex h-full items-center gap-1.5 rounded-xl border border-sky/70 bg-mist px-3 text-sm text-ink outline-none hover:border-brand focus:border-brand"
            type="button"
            onClick={() => setOpen((current) => !current)}
          >
            <span aria-hidden className="text-base leading-none">
              {flagOf(country.iso)}
            </span>
            <span className="tabular-nums">+{country.dial}</span>
            <ChevronDown aria-hidden className="size-3.5 text-muted" />
          </button>

          {open ? (
            <div
              className="absolute z-30 mt-1 w-72 overflow-hidden rounded-xl border border-sky/60 bg-surface shadow-[var(--shadow-card)]"
              role="presentation"
            >
              <div className="flex items-center gap-2 border-b border-sky/50 px-3 py-2">
                <Search aria-hidden className="size-3.5 shrink-0 text-muted" />
                <input
                  aria-controls="phone-country-list"
                  aria-label="Buscar país"
                  autoComplete="off"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                  placeholder="Buscar país…"
                  ref={search}
                  role="combobox"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                />
              </div>

              <ul
                className="max-h-60 overflow-y-auto py-1"
                id="phone-country-list"
                role="listbox"
              >
                {options.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-faint">Ningún país con ese nombre.</li>
                ) : (
                  options.map((option, index) => (
                    <li key={option.iso}>
                      <button
                        aria-selected={option.iso === country.iso}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-mist ${
                          index === active ? "bg-mist" : ""
                        } ${option.iso === country.iso ? "text-ink" : "text-soft"}`}
                        role="option"
                        type="button"
                        onClick={() => choose(option)}
                        onMouseEnter={() => setActive(index)}
                      >
                        <span aria-hidden className="text-base leading-none">
                          {flagOf(option.iso)}
                        </span>
                        <span className="flex-1 truncate">{option.name}</span>
                        <span className="tabular-nums text-faint">+{option.dial}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <input
          autoComplete="tel-national"
          className="w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          inputMode="tel"
          placeholder="99 123 456"
          value={national}
          onChange={(event) => onNational(event.target.value)}
        />
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
