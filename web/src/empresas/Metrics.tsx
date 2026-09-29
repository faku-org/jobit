import { Activity, Eye, FileText, Lightbulb, Loader2, Search, Send } from "lucide-react";
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

/** Una lista de a lo sumo cinco filas con su contador. Se usa para los rankings
 * y para los puestos buscados. */
function RankedList({
  title,
  empty,
  entries,
}: {
  title: string;
  empty: string;
  entries: { key: string; label: string; value: number; suffix?: string }[];
}) {
  const top = entries.filter((entry) => entry.value > 0);
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {top.length === 0 ? (
        <p className="mt-2 text-xs text-faint">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {top.map((entry) => (
            <li
              key={entry.key}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-sky/50 bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-ink">{entry.label}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {entry.value}
                {entry.suffix ? <span className="ml-1 text-[11px]">{entry.suffix}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** La serie diaria en dos líneas: vistas y postulaciones. Sin librerías: es un
 * `svg` estirado al contenedor, con el trazo a ancho fijo. */
function TrendChart({ points }: { points: MetricsReport["daily"] }) {
  const n = points.length;
  const max = Math.max(1, ...points.map((point) => Math.max(point.views, point.applies)));
  const total = points.reduce((sum, point) => sum + point.views + point.applies, 0);
  const x = (index: number) => (n <= 1 ? 50 : (index / (n - 1)) * 100);
  const y = (value: number) => 98 - (value / max) * 94;

  const line = (pick: (point: MetricsReport["daily"][number]) => number) =>
    points.map((point, index) => `${x(index).toFixed(2)},${y(pick(point)).toFixed(2)}`).join(" ");

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5 font-medium text-soft">
          <Activity aria-hidden className="size-3.5" />
          Actividad por día
        </span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-brand" /> vistas
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" /> postulaciones
          </span>
        </span>
      </div>

      {n === 0 || total === 0 ? (
        <p className="mt-2 text-xs text-faint">Sin actividad en esta ventana.</p>
      ) : (
        <svg
          aria-label="Vistas y postulaciones por día"
          className="mt-2 h-32 w-full"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <title>Vistas y postulaciones por día</title>
          <line stroke="var(--color-sky)" strokeOpacity="0.5" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2="100" y1="98" y2="98" />
          <line stroke="var(--color-sky)" strokeOpacity="0.3" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2="100" y1="51" y2="51" />
          <polyline
            fill="none"
            points={line((point) => point.views)}
            stroke="var(--color-brand)"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="none"
            points={line((point) => point.applies)}
            stroke="#10b981"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
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
        <Stat icon={<Eye aria-hidden className="size-3.5" />} label="Visitas a la empresa" value={report.views} />
        <Stat
          icon={<Send aria-hidden className="size-3.5" />}
          label="Postulaciones"
          value={report.applies}
        />
      </div>

      <div className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
        <TrendChart points={report.daily} />
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

      {report.keywords.length > 0 ? (
        <section>
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <Lightbulb aria-hidden className="size-3.5" />
            Palabras clave de tus publicaciones
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            Las habilidades que nombran tus avisos. Son las que va a usar el recomendador para
            acercarte a quien busca lo que ofrecés.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {report.keywords.map((keyword) => (
              <li
                key={keyword.slug}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky/60 bg-surface px-2.5 py-1 text-xs text-ink"
              >
                {keyword.label}
                <span className="tabular-nums text-faint">{keyword.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RankedList
        empty="Todavía no hay búsquedas registradas en esta ventana."
        entries={report.search_roles.map((entry) => ({
          key: entry.value,
          label: entry.label,
          value: entry.count,
        }))}
        title="Puestos más buscados en JobIt"
      />

      <RankedList
        empty="Todavía no hay vistas en esta ventana."
        entries={report.most_viewed.map((entry) => ({
          key: entry.id,
          label: entry.title,
          value: entry.views,
          suffix: "vistas",
        }))}
        title="Tus puestos más vistos"
      />

      <RankedList
        empty="Todavía no hay postulaciones en esta ventana."
        entries={report.most_applied.map((entry) => ({
          key: entry.id,
          label: entry.title,
          value: entry.applies,
          suffix: "postulaciones",
        }))}
        title="Más postulaciones"
      />

      <p className="inline-flex items-start gap-1.5 rounded-xl border border-sky/50 bg-mist px-3.5 py-2.5 text-[11px] leading-relaxed text-faint">
        <Search aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Estos números son contadores agregados —por oferta y por día— y búsquedas anónimas: dicen
          cuántas veces, nunca quién. Salen del mismo envío anónimo de estadísticas que la persona
          puede apagar, así que son una muestra de quien lo tiene prendido.
        </span>
      </p>
    </div>
  );
}
