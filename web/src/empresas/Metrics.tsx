import { Eye, FileText, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type Metrics as MetricsReport, OFFER_STATUS_LABEL, getMetrics } from "./api.ts";

const WINDOWS = [7, 30, 90];

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </span>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Ranking({
  title,
  empty,
  entries,
  metric,
}: {
  title: string;
  empty: string;
  metric: "views" | "applies";
  entries: MetricsReport["most_viewed"];
}) {
  const top = entries.filter((entry) => entry[metric] > 0);
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {top.length === 0 ? (
        <p className="mt-2 text-xs text-faint">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {top.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-sky/50 bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-ink">{entry.title}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {entry[metric]}
                <span className="ml-1 text-[11px]">
                  {metric === "views" ? "vistas" : "postulaciones"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Metrics({ onFail }: { onFail: (cause: unknown) => void }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<MetricsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      getMetrics(days)
        .then(setReport)
        .catch(onFail)
        .finally(() => setLoading(false)),
    [days, onFail],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading || !report) {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Cargando…
      </p>
    );
  }

  const published = report.offers.published;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((value) => (
          <button
            key={value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${days === value ? "bg-panel text-onpanel" : "border border-sky/70 text-ink hover:bg-mist"}`}
            type="button"
            onClick={() => {
              setLoading(true);
              setDays(value);
            }}
          >
            {value} días
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">
          {report.from} → {report.to}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<FileText aria-hidden className="size-3.5" />}
          label="Publicadas"
          value={published}
        />
        <Stat icon={<Eye aria-hidden className="size-3.5" />} label="Vistas" value={report.views} />
        <Stat
          icon={<Send aria-hidden className="size-3.5" />}
          label="Postulaciones"
          value={report.applies}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["draft", "published", "archived"] as const).map((status) => (
          <div key={status} className="rounded-lg border border-sky/50 bg-mist px-3 py-2 text-xs">
            <span className="text-muted">{OFFER_STATUS_LABEL[status]}</span>
            <span className="ml-2 font-semibold tabular-nums text-ink">
              {report.offers[status]}
            </span>
          </div>
        ))}
      </div>

      <Ranking
        empty="Todavía no hay vistas en esta ventana."
        entries={report.most_viewed}
        metric="views"
        title="Puestos más vistos"
      />
      <Ranking
        empty="Todavía no hay postulaciones en esta ventana."
        entries={report.most_applied}
        metric="applies"
        title="Más postulaciones"
      />

      <p className="rounded-xl border border-sky/50 bg-mist px-3.5 py-2.5 text-[11px] leading-relaxed text-faint">
        Estos números son contadores por oferta y por día: dicen cuántas veces, nunca quién. Salen
        del mismo envío anónimo de estadísticas que la persona puede apagar, así que son una muestra
        de quien lo tiene prendido.
      </p>
    </div>
  );
}
