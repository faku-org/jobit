import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, countryByIso, flagOf } from "../lib/countries.ts";

/**
 * Teléfono con selector de país. El país elige el prefijo, así que nadie tiene
 * que escribirlo a mano; el menú tiene alto propio y scrollea adentro, que es
 * lo que evita una lista de países interminable.
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
  const menu = useRef<HTMLDivElement>(null);
  const country = countryByIso(iso) ?? COUNTRIES[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
            <ul
              className="absolute z-30 mt-1 max-h-64 w-72 overflow-y-auto rounded-xl border border-sky/60 bg-surface py-1 shadow-[var(--shadow-card)]"
              role="listbox"
            >
              {COUNTRIES.map((option) => (
                <li key={option.iso}>
                  <button
                    aria-selected={option.iso === country.iso}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-mist ${
                      option.iso === country.iso ? "bg-mist text-ink" : "text-soft"
                    }`}
                    role="option"
                    type="button"
                    onClick={() => {
                      onIso(option.iso);
                      setOpen(false);
                    }}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {flagOf(option.iso)}
                    </span>
                    <span className="flex-1 truncate">{option.name}</span>
                    <span className="tabular-nums text-faint">+{option.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
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
