import { categoryLabel } from '@jobit/worker/categories'
import { skillsOf } from '@jobit/worker/skills'
import { db } from './db.ts'
import type { OfferStatus } from './offers.ts'

/**
 * Las métricas de una empresa, contadas sin guardar una fila por visita.
 *
 * `offer_daily` suma por oferta y por día: una fila dice "esta oferta se vio
 * N veces el 12 de marzo", nunca quién la vio. Es el único corte que se puede
 * mostrar a quien publica sin romper la Zero Data Policy, que promete que no
 * hay nada por persona.
 *
 * Suben desde el mismo canal que los eventos anónimos (`api/src/events.ts`),
 * que se recortan contra vocabularios y solo llevan el id público de la oferta.
 * Si la persona tiene apagado el envío de estadísticas, no suben: son parte de
 * lo mismo.
 */
/**
 * El embudo de una oferta, en tres pasos:
 *
 * - `view`: alguien abrió la ficha.
 * - `click`: salió al aviso original (el enlace de la oferta o el mensaje
 *   armado). Es el interés, y no se puede confirmar desde acá: del otro lado
 *   hay un sitio ajeno.
 * - `apply`: al volver, la persona confirmó que sí mandó la postulación. Es el
 *   único paso que ella declara, así que es un piso y no un total.
 *
 * Antes de v0.14 `applies` contaba el clic. Esa migración está en
 * `db-metrics.ts`.
 */
export type OfferStatKind = 'view' | 'click' | 'apply'

const STAT_COLUMN: Record<OfferStatKind, string> = {
  view: 'views',
  click: 'clicks',
  apply: 'applies',
}

const today = (now: Date = new Date()): string => now.toISOString().slice(0, 10)

/** El día calendario (UTC) `offset` días antes o después de otro. */
export function shiftDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/**
 * Suma uno al contador del día. Best-effort a propósito: un id que no es una
 * oferta propia se ignora en vez de romper el lote entero.
 */
export function bump(
  offerId: string,
  kind: OfferStatKind,
  now: Date = new Date(),
): boolean {
  const column = STAT_COLUMN[kind]
  const exists = db()
    .query<{ id: string }, [string]>('SELECT id FROM offers WHERE id = ?')
    .get(offerId)
  if (!exists) return false

  db().run(
    `INSERT INTO offer_daily (offer_id, day, ${column}) VALUES (?, ?, 1)
     ON CONFLICT(offer_id, day) DO UPDATE SET ${column} = ${column} + 1`,
    [offerId, today(now)],
  )
  return true
}

/** Los tres pasos del embudo, sumados. */
export interface Counts {
  views: number
  clicks: number
  applies: number
}

export interface OfferMetrics extends Counts {
  id: string
  title: string
  status: OfferStatus
  category: string
  published_at: string
}

export interface DailyMetrics extends Counts {
  day: string
}

/** Una oferta del embudo, con lo mismo del período anterior al lado. */
export interface OfferFunnel extends OfferMetrics {
  previous: Counts
}

/** Un rubro del embudo: lo que suman sus ofertas. */
export interface CategoryFunnel extends Counts {
  key: string
  label: string
  offers: number
  previous: Counts
}

/**
 * Un número contra el del período anterior. `pct` es `null` cuando antes no
 * había nada: dividir por cero no es "infinito", es que no hay con qué
 * comparar, y el panel lo dice en vez de inventar una variación.
 */
export interface Change {
  previous: number
  delta: number
  pct: number | null
}

/** El período de igual largo que termina el día antes de que empiece la
 * ventana. `has_data` es falso si en todo ese período no hubo ni un contador. */
export interface PreviousPeriod extends Counts {
  from: string
  to: string
  has_data: boolean
  daily: DailyMetrics[]
}

/** Una habilidad que nombran las ofertas de la empresa. Es lo que después va a
 * alimentar el recomendador: hoy se muestra para que la empresa sepa con qué
 * palabras la encuentra quien busca. */
export interface KeywordCount {
  slug: string
  label: string
  count: number
}

export interface CompanyMetrics {
  days: number
  from: string
  to: string
  offers: Record<OfferStatus, number>
  views: number
  clicks: number
  applies: number
  daily: DailyMetrics[]
  previous: PreviousPeriod
  change: Record<keyof Counts, Change>
  /** El embudo por publicación, de la que más se ve a la que menos. */
  by_offer: OfferFunnel[]
  /** Y por rubro, que es donde se ve qué tipo de aviso convierte. */
  by_category: CategoryFunnel[]
  /** Las que más se ven, en la ventana. */
  most_viewed: OfferMetrics[]
  /** Las que más postulaciones juntan, que no siempre son las mismas. */
  most_applied: OfferMetrics[]
  keywords: KeywordCount[]
}

/** El primer día que entra en una ventana de N días contada desde hoy. */
function windowStart(days: number, now: Date): string {
  const start = new Date(now.getTime() - (Math.max(days, 1) - 1) * 86_400_000)
  return today(start)
}

const countByStatus = (companyId: string): Record<OfferStatus, number> => {
  const rows = db()
    .query<{ status: OfferStatus; n: number }, [string]>(
      'SELECT status, COUNT(*) AS n FROM offers WHERE company_id = ? GROUP BY status',
    )
    .all(companyId)

  const out: Record<OfferStatus, number> = {
    draft: 0,
    published: 0,
    archived: 0,
  }
  for (const row of rows) if (row.status in out) out[row.status] = row.n
  return out
}

/** Todas las ofertas de la empresa con sus contadores dentro de la ventana. */
function offerRows(
  companyId: string,
  from: string,
  to: string,
): OfferMetrics[] {
  return db()
    .query<OfferMetrics, [string, string, string]>(
      `SELECT o.id, o.title, o.status, o.category, o.published_at,
              COALESCE(SUM(d.views), 0)   AS views,
              COALESCE(SUM(d.clicks), 0)  AS clicks,
              COALESCE(SUM(d.applies), 0) AS applies
         FROM offers o
         LEFT JOIN offer_daily d
                ON d.offer_id = o.id AND d.day >= ? AND d.day <= ?
        WHERE o.company_id = ?
        GROUP BY o.id`,
    )
    .all(from, to, companyId)
}

/** Cuenta, por habilidad, en cuántas ofertas de la empresa se nombra. Una
 * habilidad cuenta una vez por oferta, aunque la mencione tres veces. */
function keywordCounts(companyId: string): KeywordCount[] {
  const rows = db()
    .query<{ text: string }, [string]>(
      `SELECT title || ' ' || description || ' ' || requirements AS text
         FROM offers WHERE company_id = ?`,
    )
    .all(companyId)

  const counts = new Map<string, KeywordCount>()
  for (const row of rows) {
    for (const skill of skillsOf(row.text)) {
      const entry = counts.get(skill.slug) ?? {
        slug: skill.slug,
        label: skill.label,
        count: 0,
      }
      entry.count += 1
      counts.set(skill.slug, entry)
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 12)
}

export function companyMetrics(
  companyId: string,
  days = 30,
  now: Date = new Date(),
): CompanyMetrics {
  const count = Math.max(Math.floor(days), 1)
  const from = windowStart(count, now)
  const to = today(now)
  /* El período anterior mide lo mismo y termina el día antes de la ventana. */
  const previousTo = shiftDay(from, -1)
  const previousFrom = shiftDay(previousTo, -(count - 1))

  const rows = offerRows(companyId, from, to)
  const previousRows = offerRows(companyId, previousFrom, previousTo)
  const totals = sumCounts(rows)
  const previousTotals = sumCounts(previousRows)
  const previousDaily = dailySeries(companyId, previousFrom, count)

  const previous: PreviousPeriod = {
    from: previousFrom,
    to: previousTo,
    ...previousTotals,
    has_data: hasActivity(previousTotals),
    daily: previousDaily,
  }

  const mostViewed = [...rows].sort(
    (a, b) => b.views - a.views || b.applies - a.applies,
  )
  const mostApplied = [...rows].sort(
    (a, b) => b.applies - a.applies || b.views - a.views,
  )

  const before = new Map(previousRows.map((row) => [row.id, row]))
  const byOffer: OfferFunnel[] = mostViewed.map((row) => ({
    ...row,
    previous: pickCounts(before.get(row.id)),
  }))

  return {
    days: count,
    from,
    to,
    offers: countByStatus(companyId),
    ...totals,
    daily: dailySeries(companyId, from, count),
    previous,
    change: {
      views: change(totals.views, previousTotals.views),
      clicks: change(totals.clicks, previousTotals.clicks),
      applies: change(totals.applies, previousTotals.applies),
    },
    by_offer: byOffer,
    by_category: categoryFunnel(byOffer),
    most_viewed: mostViewed.slice(0, 5),
    most_applied: mostApplied.slice(0, 5),
    keywords: keywordCounts(companyId),
  }
}

const zero = (): Counts => ({ views: 0, clicks: 0, applies: 0 })

function pickCounts(row: Counts | undefined): Counts {
  return row
    ? { views: row.views, clicks: row.clicks, applies: row.applies }
    : zero()
}

function sumCounts(rows: Counts[]): Counts {
  const out = zero()
  for (const row of rows) {
    out.views += row.views
    out.clicks += row.clicks
    out.applies += row.applies
  }
  return out
}

const hasActivity = (counts: Counts): boolean =>
  counts.views + counts.clicks + counts.applies > 0

/**
 * Cuánto cambió un número contra el del período anterior. Sin nada antes no hay
 * porcentaje que dar: `pct` queda en `null` y el panel lo dice, en vez de
 * mostrar un "+∞%" o un "+100%" inventado.
 */
export function change(current: number, previous: number): Change {
  return {
    previous,
    delta: current - previous,
    pct:
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  }
}

/** La serie trae también los días sin nada: un día en cero es un dato y, si
 * se omite, la gráfica lo dibuja como si nunca hubiera pasado. */
function dailySeries(
  companyId: string,
  from: string,
  count: number,
): DailyMetrics[] {
  const to = shiftDay(from, count - 1)
  const series = new Map<string, DailyMetrics>()
  for (let index = 0; index < count; index += 1) {
    const day = shiftDay(from, index)
    series.set(day, { day, ...zero() })
  }
  const spent = db()
    .query<DailyMetrics, [string, string, string]>(
      `SELECT d.day,
              SUM(d.views)   AS views,
              SUM(d.clicks)  AS clicks,
              SUM(d.applies) AS applies
         FROM offer_daily d JOIN offers o ON o.id = d.offer_id
        WHERE o.company_id = ? AND d.day >= ? AND d.day <= ?
        GROUP BY d.day
        ORDER BY d.day`,
    )
    .all(companyId, from, to)
  for (const row of spent) {
    const point = series.get(row.day)
    if (point) {
      point.views = row.views
      point.clicks = row.clicks
      point.applies = row.applies
    }
  }
  return [...series.values()]
}

/** Suma el embudo de las ofertas por rubro. El rubro viene de la fila de la
 * oferta, no del navegador. */
function categoryFunnel(offers: OfferFunnel[]): CategoryFunnel[] {
  const groups = new Map<string, CategoryFunnel>()
  for (const offer of offers) {
    const group = groups.get(offer.category) ?? {
      key: offer.category,
      label: categoryLabel(offer.category),
      offers: 0,
      ...zero(),
      previous: zero(),
    }
    group.offers += 1
    group.views += offer.views
    group.clicks += offer.clicks
    group.applies += offer.applies
    group.previous.views += offer.previous.views
    group.previous.clicks += offer.previous.clicks
    group.previous.applies += offer.previous.applies
    groups.set(offer.category, group)
  }
  return [...groups.values()].sort(
    (a, b) => b.views - a.views || a.label.localeCompare(b.label),
  )
}

/**
 * Lo mismo para servicios. `service_daily` suma por servicio y por día; no hay
 * columna de persona y el servidor no la recibe, así que no hay nada que cruzar
 * ni siquiera si mañana existe la sesión.
 */
export type ServiceStatKind = 'view' | 'contact'

/**
 * Devuelve el rubro del servicio, que sale de su fila y no del navegador. Solo
 * cuentan los publicados: uno en borrador o suspendido no lo ve
 * nadie, y un id que no existe se ignora en vez de romper el lote.
 */
export function bumpService(
  serviceId: string,
  kind: ServiceStatKind,
  now: Date = new Date(),
): string | null {
  const column = kind === 'view' ? 'views' : 'contacts'
  const exists = db()
    .query<{ category: string }, [string]>(
      "SELECT category FROM services WHERE id = ? AND status = 'published'",
    )
    .get(serviceId)
  if (!exists) return null

  db().run(
    `INSERT INTO service_daily (service_id, day, ${column}) VALUES (?, ?, 1)
     ON CONFLICT(service_id, day) DO UPDATE SET ${column} = ${column} + 1`,
    [serviceId, today(now)],
  )
  return exists.category
}

export interface ServiceMetrics {
  id: string
  title: string
  views: number
  contacts: number
  daily: DailyServiceMetrics[]
}

export interface DailyServiceMetrics {
  day: string
  views: number
  contacts: number
}

/** Las métricas de un servicio de esa persona, o null si no es suyo: el ajeno y
 * el que no existe contestan lo mismo. */
export function serviceMetrics(
  serviceId: string,
  userId: string,
  days = 30,
  now: Date = new Date(),
): ServiceMetrics | null {
  const service = db()
    .query<{ id: string; title: string }, [string, string]>(
      'SELECT id, title FROM services WHERE id = ? AND user_id = ?',
    )
    .get(serviceId, userId)
  if (!service) return null

  const daily = db()
    .query<DailyServiceMetrics, [string, string, string]>(
      `SELECT day, views, contacts FROM service_daily
        WHERE service_id = ? AND day >= ? AND day <= ?
        ORDER BY day`,
    )
    .all(serviceId, windowStart(days, now), today(now))

  return {
    id: service.id,
    title: service.title,
    views: daily.reduce((sum, row) => sum + row.views, 0),
    contacts: daily.reduce((sum, row) => sum + row.contacts, 0),
    daily,
  }
}

/** Una fila por servicio publicado, con lo que sumó en la ventana. */
export interface ServiceDailyRow {
  service_id: string
  title: string
  category: string
  views: number
  contacts: number
}

export function serviceUsageRows(from: string, to: string): ServiceDailyRow[] {
  return db()
    .query<ServiceDailyRow, [string, string]>(
      `SELECT s.id AS service_id, s.title, s.category,
              COALESCE(SUM(d.views), 0)    AS views,
              COALESCE(SUM(d.contacts), 0) AS contacts
         FROM services s
         LEFT JOIN service_daily d
                ON d.service_id = s.id AND d.day >= ? AND d.day <= ?
        WHERE s.status = 'published'
        GROUP BY s.id`,
    )
    .all(from, to)
}
