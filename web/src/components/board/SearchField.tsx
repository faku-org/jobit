import { HelpCircle, Search, X } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useEffectEvent, useState } from "react";
import { fold } from "../../lib/catalog.ts";
import { employerSlug, fetchEmployers } from "../../lib/employers.ts";
import { SHORTCUTS } from "../../lib/search.ts";
import { fieldClass } from "../../lib/styles.ts";
import type { Facet } from "../../lib/types.ts";

interface SearchFieldProps {
  /** La búsqueda que está corriendo, ya sin el retardo. */
  value: string;
  onChange: (value: string) => void;
  /** Empresas para el desplegable que abre la `@`. */
  employers?: Facet[];
  delayMs?: number;
}

/** El trozo `@algo` que se está escribiendo al final del texto, si hay uno. */
function activeMention(text: string): { query: string; at: number } | null {
  const match = /(?:^|\s)@([^\s]*)$/.exec(text);
  if (!match) return null;
  const query = match[1] ?? "";
  return { query, at: text.length - query.length - 1 };
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <m.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="search-help-title"
        aria-modal
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-sky/40 px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink" id="search-help-title">
            Atajos del buscador
          </h2>
          <button
            aria-label="Cerrar"
            className="rounded-lg p-1 text-muted transition-colors hover:text-ink"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="px-4 py-4">
          <p className="text-xs leading-relaxed text-muted">
            Escribilos en el buscador; el texto suelto sigue buscando como siempre. Podés mezclar
            varios, por ejemplo{" "}
            <code className="rounded bg-mist px-1">soporte @urudata modalidad:remoto</code>.
          </p>
          <dl className="mt-3 divide-y divide-sky/40 overflow-hidden rounded-xl border border-sky/50">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.syntax} className="flex items-baseline gap-3 px-3 py-2">
                <dt className="shrink-0 font-mono text-xs font-medium text-brand">
                  {shortcut.syntax}
                </dt>
                <dd className="min-w-0 text-right text-xs text-soft">{shortcut.what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </m.div>
    </div>
  );
}

/**
 * El buscador: la letra se escribe acá adentro y sale recién cuando la persona
 * frena.
 *
 * Lo que se está tecleando es estado de este campo y de nadie más. Cuando vivía
 * arriba, cada tecla volvía a renderizar el tablero entero para cambiar un
 * `value` que mira solo este input: medido sobre cien tarjetas eran 23 ms por
 * tecla, contra 0,7 ms con la lista vacía. El retardo ya existía, pero solo
 * frenaba el pedido a la API, no el renderizado.
 *
 * Hacia afuera se comporta igual que antes: el valor que baja manda cuando
 * cambia por algo que no fue tipear (un enlace compartido, el botón de limpiar
 * los filtros, tocar un puesto en Mercado).
 */
export function SearchField({ value, onChange, employers = [], delayMs = 300 }: SearchFieldProps) {
  const [text, setText] = useState(value);
  const [helpOpen, setHelpOpen] = useState(false);
  /**
   * `sent` es lo último que este campo mandó hacia arriba y `seen` lo último
   * que vio bajar. Con los dos alcanza para distinguir "volvió lo que mandé
   * yo", que no toca nada, de "lo cambió otra cosa", que es lo único que puede
   * pisar lo que se está escribiendo.
   */
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);
  /** Empresas que trae la API para la `@` que se está escribiendo. */
  const [remote, setRemote] = useState<Facet[]>([]);

  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setSent(value);
      setText(value);
    }
  }

  /** El callback cambia de identidad cada vez que repinta el tablero, y no
   * puede reiniciar el reloj: si lo hiciera, escribir mientras algo de arriba
   * se actualiza no publicaría nunca. */
  const publish = useEffectEvent((next: string) => {
    setSent(next);
    onChange(next);
  });

  useEffect(() => {
    if (text === sent) return;

    const timer = setTimeout(() => publish(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, sent, delayMs]);

  /** Limpiar no es escribir: sale en el momento, sin esperar el retardo. */
  const clear = (): void => {
    setText("");
    setSent("");
    onChange("");
  };

  const mention = activeMention(text);
  const mentionQuery = mention?.query ?? "";

  useEffect(() => {
    /** Con menos de dos letras, alcanza con las que ya están cargadas. */
    if (mentionQuery.length < 2) {
      setRemote([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchEmployers("", mentionQuery, controller.signal)
        .then(setRemote)
        .catch(() => {});
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mentionQuery]);

  const needle = mention ? fold(mention.query) : "";
  const local = employers
    .filter((facets) => fold(facets.label).includes(needle))
    /** Los que empiezan con lo tipeado primero; después, los más grandes. */
    .sort(
      (a, b) =>
        Number(fold(b.label).startsWith(needle)) - Number(fold(a.label).startsWith(needle)) ||
        b.count - a.count,
    );
  const suggestions = mention ? (remote.length > 0 ? remote : local).slice(0, 8) : [];

  const pick = (employer: Facet): void => {
    if (!mention) return;
    const next = `${text.slice(0, mention.at)}@${employerSlug(employer.label)} `;
    setText(next);
    setSent(next);
    onChange(next);
  };

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brand"
      />
      <input
        aria-label="Buscar ofertas"
        className={`${fieldClass} py-2.5 pr-[4.5rem] pl-10 placeholder:text-faint`}
        placeholder="Buscar por puesto, empresa, ciudad o palabra de la descripción"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {text ? (
        <button
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-9 -translate-y-1/2 rounded-md p-0.5 text-faint transition-colors hover:text-ink"
          type="button"
          onClick={clear}
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}

      <button
        aria-label="Atajos del buscador"
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-faint transition-colors hover:text-ink"
        type="button"
        onClick={() => setHelpOpen(true)}
      >
        <HelpCircle aria-hidden className="size-4" />
      </button>

      {suggestions.length > 0 ? (
        <ul className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-sky/60 bg-surface p-1 shadow-[var(--shadow-panel)]">
          {suggestions.map((employer) => (
            <li key={employer.value}>
              <button
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-mist"
                type="button"
                onClick={() => pick(employer)}
              >
                <span className="min-w-0 truncate">{employer.label}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{employer.count}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {helpOpen ? <ShortcutHelp onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
