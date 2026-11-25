/**
 * El corte que muestra el panel de métricas, como tablas para bajar.
 *
 * Es exactamente la misma ventana que se ve en pantalla (`companyMetrics`): el
 * archivo no recalcula nada, solo aplana. Sigue la forma de `export.ts`: cada
 * fila es un corte, la columna `tabla` dice cuál, y las columnas son siempre las
 * mismas. El CSV junta todas las tablas bajo un encabezado; el XLSX trae una
 * pestaña por tabla.
 *
 * Sin datos en el período anterior las columnas `*_anterior` quedan vacías: un
 * cero ahí diría "no pasó nada", y lo cierto es que no hay con qué comparar.
 */
import { type Cell, toCsv } from './csv.ts'
import type { CompanyMetrics, Counts } from './metrics.ts'
import type { Sheet } from './xlsx.ts'

export const METRICS_COLUMNS = [
  'tabla',
  'clave',
  'etiqueta',
  'estado',
  'vistas',
  'clics',
  'postulaciones',
  'vistas_anterior',
  'clics_anterior',
  'postulaciones_anterior',
] as const

export interface MetricsTable {
  name: string
  rows: Cell[][]
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'borrador',
  published: 'publicada',
  archived: 'archivada',
}

/** Una fila: lo actual y, al lado, lo del período anterior si lo hay. */
function row(
  table: string,
  key: string,
  label: string,
  status: string | null,
  current: Counts,
  previous: Counts | null,
): Cell[] {
  return [
    table,
    key,
    label,
    status,
    current.views,
    current.clicks,
    current.applies,
    previous?.views ?? null,
    previous?.clicks ?? null,
    previous?.applies ?? null,
  ]
}

export function metricsTables(report: CompanyMetrics): MetricsTable[] {
  const compare = report.previous.has_data
  const previous = (counts: Counts): Counts | null => (compare ? counts : null)

  return [
    {
      name: 'resumen',
      rows: [
        row(
          'resumen',
          `${report.from}..${report.to}`,
          `Últimos ${report.days} días`,
          null,
          report,
          previous(report.previous),
        ),
      ],
    },
    {
      name: 'diario',
      rows: report.daily.map((day, index) => {
        const before = report.previous.daily[index]
        return row(
          'diario',
          day.day,
          day.day,
          null,
          day,
          before ? previous(before) : null,
        )
      }),
    },
    {
      name: 'oferta',
      rows: report.by_offer.map((offer) =>
        row(
          'oferta',
          offer.id,
          offer.title,
          STATUS_LABEL[offer.status] ?? offer.status,
          offer,
          previous(offer.previous),
        ),
      ),
    },
    {
      name: 'rubro',
      rows: report.by_category.map((category) =>
        row(
          'rubro',
          category.key,
          category.label,
          null,
          category,
          previous(category.previous),
        ),
      ),
    },
  ]
}

/** Todas las tablas, una abajo de la otra, bajo un solo encabezado. */
export function metricsCsv(report: CompanyMetrics): string {
  const rows: Cell[][] = [[...METRICS_COLUMNS]]
  for (const table of metricsTables(report)) rows.push(...table.rows)
  return toCsv(rows)
}

/** Saca las columnas que en esta tabla no tienen ni un dato. */
function used(header: readonly string[], body: Cell[][]): Cell[][] {
  const keep = header.map((_, index) =>
    body.some((cells) => cells[index] !== null),
  )
  const pick = (cells: readonly Cell[]): Cell[] =>
    cells.filter((_, index) => keep[index])
  return [pick(header), ...body.map(pick)]
}

/** Una pestaña por tabla, sin la columna `tabla`: el nombre ya lo dice. */
export function metricsSheets(report: CompanyMetrics): Sheet[] {
  const header = METRICS_COLUMNS.slice(1)
  return metricsTables(report).map((table) => ({
    name: table.name,
    rows: used(
      header,
      table.rows.map((cells) => cells.slice(1)),
    ),
  }))
}

/** El nombre lleva el último día del corte: dos descargas de ventanas distintas
 * no se pisan en la carpeta de descargas. */
export const metricsFilename = (
  report: CompanyMetrics,
  extension: string,
): string => `jobit-metricas-${report.days}d-${report.to}.${extension}`
