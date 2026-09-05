import { RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { EDUCATION_LABEL, type EducationLevel } from "../lib/education.ts";
import { type UsageCount, type UsageLabelled, type UsageReport, getUsage } from "./api.ts";

/**
 * Lo que ya llegó, leído de vuelta. Es la única pantalla del panel que no
 * administra nada: no hay nada que tocar acá, solo mirar.
 */

const RANGES = [7, 30, 90] as const;

/** Los nombres de filtro son los de la API; acá se escriben como los ve quien
 * los usa en la app. */
const FILTER_LABEL: Record<string, string> = {
  q: "Texto",
  category: "Rubro",
  department: "Departamento",
  level: "Nivel",
  remote: "Modalidad",
  job_type: "Jornada",
  salary: "Sueldo",
  no_experience: "Sin experiencia",
  days: "Antigüedad",
  sort: "Orden",
  source: "Fuente",
};

const SOURCE_LABEL: Record<string, string> = {
  jobit: "JobIt",
  buscojobs: "BuscoJobs",
  gallito: "Gallito",
  uruguayconcursa: "Uruguay Concursa",
};

const counter = new Intl.NumberFormat("es-UY");

const dayLabel = (day: string): string => day.slice(8) + "/" + day.slice(5, 7);

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-sky/70 bg-surface p-4">
      <h2 className="text-xs font-semibold tracking-tight text-ink">{title}</h2>
      {note ? <p className="mt-0.5 text-[11px] text-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border border-sky/70 bg-surface px-3.5 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-ink">
        {counter.format(value)}
      </p>
      {note ? <p className="text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}

interface Row {
  key: string;
  label: string;
  count: number;
  href?: string;
  note?: string;
}

function Bars({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <p className="py-2 text-[11px] text-muted">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count));

  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            {row.href ? (
              <a
                className="min-w-0 truncate text-xs text-ink hover:text-brand hover:underline"
                href={row.href}
                rel="noreferrer"
                target="_blank"
              >
                {row.label}
              </a>
            ) : (
              <span className="min-w-0 truncate text-xs text-ink">{row.label}</span>
            )}
            <span className="shrink-0 text-[11px] text-muted tabular-nums">
              {row.note ? `${row.note} · ` : ""}
              {counter.format(row.count)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max((row.count / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** La actividad día por día, apilada: un día sin nada se dibuja igual, porque
 * el hueco también dice algo. */
function Daily({ report }: { report: UsageReport }) {
  const max = Math.max(...report.daily.map((day) => day.summaries + day.searches + day.applies), 1);

  return (
    <>
      <ol className="flex h-24 items-end gap-px">
        {report.daily.map((day) => {
          const total = day.summaries + day.searches + day.applies;
          const height = (total / max) * 100;
          return (
            <li
              key={day.day}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${dayLabel(day.day)} · ${day.summaries} resúmenes · ${day.searches} búsquedas · ${day.applies} postular`}
            >
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: `${height}%` }}
              >
                <div className="bg-brand" style={{ flexGrow: day.searches }} />
                <div className="bg-brand/45" style={{ flexGrow: day.applies }} />
                <div className="bg-ink/20" style={{ flexGrow: day.summaries }} />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-[2px] bg-brand" /> Búsquedas
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-[2px] bg-brand/45" /> Postular
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-[2px] bg-ink/20" /> Resúmenes
        </span>
        <span className="ml-auto tabular-nums">
          {dayLabel(report.from)} — {dayLabel(report.to)}
        </span>
      </div>
    </>
  );
}

const educationLabel = (value: string): string =>
  value === "" ? "Sin cargar" : (EDUCATION_LABEL[value as EducationLevel] ?? value);

const toRows = (counts: UsageCount[], label: (value: string) => string): Row[] =>
  counts.map((row) => ({ key: row.value, label: label(row.value), count: row.count }));

/** Los cortes que tienen catálogo ya vienen con el nombre puesto de la API. */
const namedRows = (counts: UsageLabelled[]): Row[] =>
  counts.map((row) => ({ key: row.value, label: row.label, count: row.count }));

export function Usage({ onFail }: { onFail: (cause: unknown) => void }) {
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getUsage(days)
      .then(setReport)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [days, onFail]);

  useEffect(refresh, [refresh]);

  if (!report) return <p className="text-xs text-muted">{loading ? "Cargando…" : ""}</p>;

  const quiet = report.summaries + report.searches + report.applies === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((value) => (
          <button
            key={value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${days === value ? "bg-panel text-onpanel" : "border border-sky/70 text-ink hover:bg-mist"}`}
            type="button"
            onClick={() => setDays(value)}
          >
            {value} días
          </button>
        ))}

        <button
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-mist hover:text-ink"
          type="button"
          onClick={refresh}
        >
          <RefreshCw aria-hidden className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {quiet ? (
        <p className="mt-4 rounded-xl border border-dashed border-sky/70 px-4 py-8 text-center text-xs text-muted">
          Todavía no llegó nada en esta ventana. Se llena solo cuando alguien usa la app con el
          interruptor de estadísticas prendido.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Resúmenes diarios" note="uno por navegador por día" value={report.summaries} />
        <Stat label="Búsquedas" value={report.searches} />
        <Stat label="Clicks en postular" value={report.applies} />
        <Stat
          label="Sin resultados"
          note={report.searches === 0 ? undefined : `de ${counter.format(report.searches)}`}
          value={report.empty}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Guardadas" value={report.saved} />
        <Stat label="Postulaciones" value={report.applications} />
        <Stat label="Entrevistas" value={report.interviews} />
        <Stat label="Cerradas" value={report.closed} />
      </div>

      <div className="mt-3">
        <Card note="Cada barra es un día del rango." title="Actividad">
          <Daily report={report} />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card note="El puesto que nombra lo que se escribió." title="Qué se busca">
          <Bars empty="Nadie buscó todavía." rows={namedRows(report.roles)} />
        </Card>

        <Card note="Lo que se busca y el tablero no tiene." title="Búsquedas sin resultados">
          <Bars empty="Toda búsqueda devolvió algo." rows={namedRows(report.emptyRoles)} />
        </Card>

        <Card note="Cuántas veces se abrió el aviso original." title="Ofertas más clickeadas">
          <Bars
            empty="Ningún click en postular."
            rows={report.jobs.map((job) => ({
              key: job.id,
              label: job.title === "" ? job.id : job.title,
              count: job.count,
              href: job.url === "" ? undefined : job.url,
              note: job.company === "" ? undefined : job.company,
            }))}
          />
        </Card>

        <Card note="El rubro de la oferta que se clickeó." title="Rubros que se postulan">
          <Bars empty="Ningún click en postular." rows={namedRows(report.categories)} />
        </Card>

        <Card note="Cuáles se usan, nunca con qué valor." title="Filtros usados">
          <Bars
            empty="Nadie filtró todavía."
            rows={toRows(report.filters, (value) => FILTER_LABEL[value] ?? value)}
          />
        </Card>

        <Card note="Lo que cargó quien mandó el resumen." title="Nivel educativo">
          <Bars empty="Nadie cargó su nivel." rows={toRows(report.education, educationLabel)} />
        </Card>

        <Card note="Las fuentes de lo que quedó guardado." title="Fuentes">
          <Bars
            empty="Nadie guardó ofertas todavía."
            rows={toRows(report.sources, (value) => SOURCE_LABEL[value] ?? value)}
          />
        </Card>
      </div>

      <p className="mt-4 text-[11px] text-muted">
        Sale de <code>stats.jsonl</code> y <code>events.jsonl</code>, que se escriben sin
        identificador y con el día y nunca la hora: son filas contadas, no personas.
      </p>
    </>
  );
}
