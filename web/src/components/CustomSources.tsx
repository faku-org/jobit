import { Check, ChevronDown, Code2, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { type CustomFeed, type FeedResult, MAX_FEEDS, isFeedUrl, newFeedId } from "../lib/feed.ts";
import { fadeUpTransition } from "../lib/motion.ts";

interface CustomSourcesProps {
  feeds: CustomFeed[];
  /** What each enabled feed answered on the last read. */
  results: FeedResult[];
  loading: boolean;
  onChange: (feeds: CustomFeed[]) => void;
}

const inputClass =
  "w-full rounded-lg border border-onpanel/20 bg-onpanel/5 px-2.5 py-1.5 text-xs text-onpanel outline-none transition-colors placeholder:text-onpanel/40 focus:border-sky";

const EXAMPLE = `{
  "jobs": [
    {
      "title": "Backend developer",
      "apply_url": "https://…",
      "company": "Acme",
      "department": "Montevideo",
      "category": "tecnologia",
      "date_posted": "2026-09-01",
      "remote": "remote",
      "level": "mid",
      "salary": { "min": 90000, "currency": "UYU" },
      "description": "…"
    }
  ]
}`;

/**
 * The bundled boards are scraped by the worker, so adding one is a code
 * change. This is the way out for somebody who can publish a feed themselves:
 * a URL returning the app's own job shape, read straight from the browser and
 * shown in its own group so its provenance is never in doubt.
 */
export function CustomSources({ feeds, results, loading, onChange }: CustomSourcesProps) {
  const [open, setOpen] = useState(feeds.length > 0);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const full = feeds.length >= MAX_FEEDS;
  const valid = isFeedUrl(url.trim());

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || full) return;
    const trimmed = url.trim();
    if (feeds.some((feed) => feed.url === trimmed)) return;

    onChange([
      ...feeds,
      {
        id: newFeedId(),
        url: trimmed,
        label: label.trim().slice(0, 40) || new URL(trimmed).hostname,
        enabled: true,
      },
    ]);
    setUrl("");
    setLabel("");
  };

  const update = (id: string, patch: Partial<CustomFeed>) =>
    onChange(feeds.map((feed) => (feed.id === id ? { ...feed, ...patch } : feed)));

  const resultOf = (id: string) => results.find((result) => result.feedId === id);

  return (
    <div>
      <button
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase transition-colors hover:text-onpanel"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown
          aria-hidden
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
        <Code2 aria-hidden className="size-3" />
        Fuentes propias
        {feeds.length > 0 ? <span className="tabular-nums">({feeds.length})</span> : null}
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
            <p className="mt-2 text-[11px] leading-relaxed text-onpanel/50">
              Para quien pueda publicar un feed propio: una URL que devuelva JSON con un array de
              ofertas, o un objeto con <code className="text-onpanel/70">jobs</code>. Se lee desde
              tu navegador, así que tiene que estar servida por https y con CORS abierto. No pasa
              por la API de JobIt.
            </p>

            {feeds.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {feeds.map((feed) => {
                  const result = resultOf(feed.id);
                  return (
                    <li key={feed.id} className="rounded-xl bg-onpanel/10 px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`Usar ${feed.label}`}
                          checked={feed.enabled}
                          className="size-3.5 shrink-0 accent-sky"
                          type="checkbox"
                          onChange={(event) => update(feed.id, { enabled: event.target.checked })}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-onpanel">{feed.label}</p>
                          <p className="truncate text-[10px] text-onpanel/45">{feed.url}</p>
                        </div>
                        <button
                          aria-label={`Quitar ${feed.label}`}
                          className="shrink-0 rounded-md p-1 text-onpanel/50 transition-colors hover:bg-onpanel/15 hover:text-onpanel"
                          type="button"
                          onClick={() => onChange(feeds.filter((item) => item.id !== feed.id))}
                        >
                          <X aria-hidden className="size-3.5" />
                        </button>
                      </div>

                      {feed.enabled ? (
                        <p className="mt-1.5 flex items-center gap-1.5 pl-5.5 text-[10px]">
                          {loading && !result ? (
                            <>
                              <Loader2
                                aria-hidden
                                className="size-3 animate-spin text-onpanel/50"
                              />
                              <span className="text-onpanel/50">Leyendo…</span>
                            </>
                          ) : result?.error ? (
                            <>
                              <TriangleAlert aria-hidden className="size-3 shrink-0 text-sky" />
                              <span className="text-onpanel/70">{result.error}</span>
                            </>
                          ) : result ? (
                            <>
                              <Check aria-hidden className="size-3 shrink-0 text-sky" />
                              <span className="text-onpanel/60 tabular-nums">
                                {result.jobs.length} ofertas
                              </span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {full ? (
              <p className="mt-3 text-[11px] text-onpanel/45">
                Llegaste al máximo de {MAX_FEEDS} fuentes propias.
              </p>
            ) : (
              <form className="mt-3 space-y-1.5" onSubmit={add}>
                <input
                  aria-label="URL del feed"
                  className={inputClass}
                  placeholder="https://mi-servidor/jobs.json"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <div className="flex gap-1.5">
                  <input
                    aria-label="Nombre de la fuente"
                    className={inputClass}
                    maxLength={40}
                    placeholder="Nombre (opcional)"
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                  <button
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-onpanel/10 px-2.5 text-xs font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel disabled:opacity-40"
                    disabled={!valid}
                    type="submit"
                  >
                    <Plus aria-hidden className="size-3.5" />
                    Agregar
                  </button>
                </div>
              </form>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-medium text-onpanel/50 transition-colors hover:text-onpanel">
                Ver el formato esperado
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-onpanel/10 p-2.5 text-[10px] leading-relaxed text-onpanel/75">
                {EXAMPLE}
              </pre>
              <p className="mt-1.5 text-[10px] leading-relaxed text-onpanel/45">
                Solo <code>title</code> y <code>apply_url</code> son obligatorios. El resto sigue
                los mismos valores que la API: <code>category</code> como slug de rubro,{" "}
                <code>level</code> entry/mid/senior, <code>remote</code> remote/hybrid,{" "}
                <code>job_type</code> full_time/part_time/internship.
              </p>
            </details>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
