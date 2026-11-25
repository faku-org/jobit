import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BellOff,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  Minus,
  Search,
  Send,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  type AlertSettings,
  type Change,
  type Counts,
  type Metrics as MetricsReport,
  OFFER_STATUS_LABEL,
  getAlerts,
  getMetrics,
  metricsFileUrl,
  setAlerts,
} from './api.ts'

const WINDOWS = [7, 30, 90]

/**
 * Cuánto cambió contra el período anterior de igual largo. Sin nada antes lo
 * dice, en vez de mostrar una variación inventada: dividir por cero no es
 * "infinito", es que no hay con qué comparar.
 */
function Delta({ change, hasData }: { change: Change; hasData: boolean }) {
  if (!hasData) {
    return (
      <p className="mt-1 text-[11px] text-faint">
        Sin datos del período anterior
      </p>
    )
  }
  if (change.pct === null) {
    return (
      <p className="mt-1 text-[11px] text-faint">
        Antes: {change.previous} · sin base para comparar
      </p>
    )
  }
  const Icon =
    change.delta > 0 ? ArrowUpRight : change.delta < 0 ? ArrowDownRight : Minus
  const tone =
    change.delta > 0
      ? 'text-emerald-600'
      : change.delta < 0
        ? 'text-rose-600'
        : 'text-faint'
  return (
    <p className={`mt-1 inline-flex items-center gap-1 text-[11px] ${tone}`}>
      <Icon aria-hidden className="size-3" />
      {change.delta > 0 ? '+' : ''}
      {change.pct}%{' '}
      <span className="text-faint">(antes {change.previous})</span>
    </p>
  )
}

function Stat({
  icon,
  label,
  value,
  change,
  hasData = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  change?: Change
  hasData?: boolean
}) {
  return (
    <div className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </span>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      {change ? <Delta change={change} hasData={hasData} /> : null}
    </div>
  )
}

/** Qué parte de un paso pasó al siguiente. Vacío si el paso de arriba es cero. */
const rate = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'

/** Vistas → clics al aviso → postulaciones, con lo que pasa de un paso al otro. */
function Funnel({ counts }: { counts: Counts }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted">
      <span title="Vistas de la ficha">{counts.views}</span>
      <ChevronRight aria-hidden className="size-3 text-faint" />
      <span title="Clics al aviso original">
        {counts.clicks}{' '}
        <span className="text-[10px] text-faint">
          ({rate(counts.clicks, counts.views)})
        </span>
      </span>
      <ChevronRight aria-hidden className="size-3 text-faint" />
      <span title="Postulaciones confirmadas">
        {counts.applies}{' '}
        <span className="text-[10px] text-faint">
          ({rate(counts.applies, counts.clicks)})
        </span>
      </span>
    </span>
  )
}

/** El embudo por rubro y por publicación. Las dos listas usan el mismo corte. */
function FunnelSection({ report }: { report: MetricsReport }) {
  const offers = report.by_offer.filter(
    (offer) => offer.views + offer.clicks + offer.applies > 0,
  )
  const categories = report.by_category.filter(
    (category) => category.views + category.clicks + category.applies > 0,
  )

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
        Embudo: vistas → clics al aviso → postulaciones
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-faint">
        El porcentaje es la parte que pasó al paso siguiente. Un clic es salir
        al aviso original; la postulación cuenta solo si la persona confirma que
        la mandó, así que es un piso y no un total.
      </p>

      {offers.length === 0 ? (
        <p className="mt-2 text-xs text-faint">
          Todavía no hay actividad en esta ventana.
        </p>
      ) : (
        <>
          <h3 className="mt-3 text-[11px] font-semibold text-soft">
            Por rubro
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {categories.map((category) => (
              <li
                key={category.key}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-sky/50 bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-ink">
                  {category.label}
                  <span className="ml-1.5 text-[11px] text-faint">
                    {category.offers}{' '}
                    {category.offers === 1 ? 'oferta' : 'ofertas'}
                  </span>
                </span>
                <Funnel counts={category} />
              </li>
            ))}
          </ul>

          <h3 className="mt-3 text-[11px] font-semibold text-soft">
            Por publicación
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-sky/50 bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-ink">{offer.title}</span>
                <Funnel counts={offer} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Descargar el mismo corte que se ve en pantalla. Son enlaces: el navegador los
 * baja con la sesión de la empresa. */
function ExportLinks({ days }: { days: number }) {
  const style =
    'inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist'
  return (
    <span className="flex items-center gap-2">
      <a className={style} download href={metricsFileUrl(days, 'csv')}>
        <Download aria-hidden className="size-3.5" />
        CSV
      </a>
      <a className={style} download href={metricsFileUrl(days, 'xlsx')}>
        <Download aria-hidden className="size-3.5" />
        XLSX
      </a>
    </span>
  )
}

/** El interruptor de las alertas por correo. */
function AlertsToggle({ onFail }: { onFail: (cause: unknown) => void }) {
  const [settings, setSettings] = useState<AlertSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAlerts().then(setSettings).catch(onFail)
  }, [onFail])

  if (!settings) return null

  const toggle = () => {
    setSaving(true)
    setAlerts(!settings.enabled)
      .then(setSettings)
      .catch(onFail)
      .finally(() => setSaving(false))
  }

  const Icon = settings.enabled ? Bell : BellOff
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky/50 bg-mist px-3.5 py-2.5">
      <p className="inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
        <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Alertas por correo: te avisamos si una oferta tiene un pico de vistas
          y nadie sale al aviso, o si lleva una semana sin una visita.
          {settings.enabled && settings.recipients === 0
            ? ' No tenés ningún correo verificado: sin uno no podemos avisarte.'
            : null}
        </span>
      </p>
      <button
        aria-pressed={settings.enabled}
        className="rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface disabled:opacity-60"
        disabled={saving}
        type="button"
        onClick={toggle}
      >
        {settings.enabled ? 'Apagar alertas' : 'Prender alertas'}
      </button>
    </div>
  )
}

/** Una lista de a lo sumo cinco filas con su contador. Se usa para los rankings
 * y para los puestos buscados. */
function RankedList({
  title,
  empty,
  entries,
}: {
  title: string
  empty: string
  entries: { key: string; label: string; value: number; suffix?: string }[]
}) {
  const top = entries.filter((entry) => entry.value > 0)
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </h2>
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
                {entry.suffix ? (
                  <span className="ml-1 text-[11px]">{entry.suffix}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** La serie diaria: vistas, clics y postulaciones, y las vistas del período
 * anterior en trazo punteado para ver si se viene mejor o peor. Sin librerías:
 * es un `svg` estirado al contenedor, con el trazo a ancho fijo. */
function TrendChart({
  points,
  previous,
}: {
  points: MetricsReport['daily']
  /** Vacío cuando antes no hubo datos: no se dibuja una línea en cero. */
  previous: MetricsReport['daily']
}) {
  const n = points.length
  const max = Math.max(
    1,
    ...points.map((point) =>
      Math.max(point.views, point.clicks, point.applies),
    ),
    ...previous.map((point) => point.views),
  )
  const total = points.reduce(
    (sum, point) => sum + point.views + point.clicks + point.applies,
    0,
  )
  const x = (index: number) => (n <= 1 ? 50 : (index / (n - 1)) * 100)
  const y = (value: number) => 98 - (value / max) * 94

  const line = (
    pick: (point: MetricsReport['daily'][number]) => number,
    series: MetricsReport['daily'] = points,
  ) =>
    series
      .map(
        (point, index) => `${x(index).toFixed(2)},${y(pick(point)).toFixed(2)}`,
      )
      .join(' ')

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
            <span className="size-2 rounded-full bg-amber-500" /> clics
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />{' '}
            postulaciones
          </span>
          {previous.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-0 w-3 border-t-2 border-dashed border-brand/60" />{' '}
              vistas antes
            </span>
          ) : null}
        </span>
      </div>

      {n === 0 || total === 0 ? (
        <p className="mt-2 text-xs text-faint">
          Sin actividad en esta ventana.
        </p>
      ) : (
        <svg
          aria-label="Vistas, clics y postulaciones por día"
          className="mt-2 h-32 w-full"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <title>Vistas, clics y postulaciones por día</title>
          <line
            stroke="var(--color-sky)"
            strokeOpacity="0.5"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            x1="0"
            x2="100"
            y1="98"
            y2="98"
          />
          <line
            stroke="var(--color-sky)"
            strokeOpacity="0.3"
            strokeDasharray="3 3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            x1="0"
            x2="100"
            y1="51"
            y2="51"
          />
          {previous.length > 0 ? (
            <polyline
              fill="none"
              points={line((point) => point.views, previous)}
              stroke="var(--color-brand)"
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
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
            points={line((point) => point.clicks)}
            stroke="#f59e0b"
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
  )
}

export function Metrics({ onFail }: { onFail: (cause: unknown) => void }) {
  const [days, setDays] = useState(30)
  const [report, setReport] = useState<MetricsReport | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(
    () =>
      getMetrics(days)
        .then(setReport)
        .catch(onFail)
        .finally(() => setLoading(false)),
    [days, onFail],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading || !report) {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Cargando…
      </p>
    )
  }

  const published = report.offers.published
  const hasPrevious = report.previous.has_data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((value) => (
          <button
            key={value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${days === value ? 'bg-panel text-onpanel' : 'border border-sky/70 text-ink hover:bg-mist'}`}
            type="button"
            onClick={() => {
              setLoading(true)
              setDays(value)
            }}
          >
            {value} días
          </button>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-faint">
            {report.from} → {report.to}
          </span>
          <ExportLinks days={days} />
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          icon={<FileText aria-hidden className="size-3.5" />}
          label="Publicadas"
          value={published}
        />
        <Stat
          change={report.change.views}
          hasData={hasPrevious}
          icon={<Eye aria-hidden className="size-3.5" />}
          label="Vistas"
          value={report.views}
        />
        <Stat
          change={report.change.clicks}
          hasData={hasPrevious}
          icon={<ExternalLink aria-hidden className="size-3.5" />}
          label="Clics al aviso"
          value={report.clicks}
        />
        <Stat
          change={report.change.applies}
          hasData={hasPrevious}
          icon={<Send aria-hidden className="size-3.5" />}
          label="Postulaciones"
          value={report.applies}
        />
      </div>
      {hasPrevious ? null : (
        <p className="-mt-3 text-[11px] text-faint">
          No hay actividad registrada entre {report.previous.from} y{' '}
          {report.previous.to}, así que no hay variación para mostrar.
        </p>
      )}

      <div className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
        <TrendChart
          points={report.daily}
          previous={hasPrevious ? report.previous.daily : []}
        />
      </div>

      <FunnelSection report={report} />

      <div className="grid gap-3 sm:grid-cols-3">
        {(['draft', 'published', 'archived'] as const).map((status) => (
          <div
            key={status}
            className="rounded-lg border border-sky/50 bg-mist px-3 py-2 text-xs"
          >
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
            Las habilidades que nombran tus avisos. Son las que va a usar el
            recomendador para acercarte a quien busca lo que ofrecés.
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
          suffix: 'vistas',
        }))}
        title="Tus puestos más vistos"
      />

      <RankedList
        empty="Todavía no hay postulaciones en esta ventana."
        entries={report.most_applied.map((entry) => ({
          key: entry.id,
          label: entry.title,
          value: entry.applies,
          suffix: 'postulaciones',
        }))}
        title="Más postulaciones"
      />

      <AlertsToggle onFail={onFail} />

      <p className="inline-flex items-start gap-1.5 rounded-xl border border-sky/50 bg-mist px-3.5 py-2.5 text-[11px] leading-relaxed text-faint">
        <Search aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Estos números son contadores agregados —por oferta y por día— y
          búsquedas anónimas: dicen cuántas veces, nunca quién. Salen del mismo
          envío anónimo de estadísticas que la persona puede apagar, así que son
          una muestra de quien lo tiene prendido.
        </span>
      </p>
    </div>
  )
}
