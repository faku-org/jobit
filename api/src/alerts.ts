import { db } from './db.ts'
import { publicOrigin, sendMail, type Mail } from './mail.ts'
import { shiftDay, type Counts } from './metrics.ts'
import type { Result } from './types.ts'

/**
 * Alertas por correo para quien publica: dos señales que piden hacer algo.
 *
 * - `views_no_applies`: la oferta tuvo un pico de vistas y nadie salió al
 *   aviso. Algo en la ficha frena a quien llega (sueldo, requisitos, el enlace).
 * - `no_visits`: una oferta publicada hace días que nadie abre. No la encuentra
 *   nadie: título, rubro o ubicación.
 *
 * Todo sale de los contadores de `offer_daily`; no hay nada por persona. La
 * detección es una función pura (`detectAlerts`), que se prueba con datos
 * sintéticos; el resto de este archivo solo lee, manda y recuerda qué mandó.
 */
export type AlertKind = 'views_no_applies' | 'no_visits'

export const ALERT_KINDS: readonly AlertKind[] = [
  'views_no_applies',
  'no_visits',
]

/** Los umbrales, en un solo lugar para poder afinarlos sin tocar la lógica. */
export const THRESHOLDS = {
  /** Vistas del día mínimas para hablar de pico: debajo es ruido. */
  spikeMinViews: 10,
  /** Cuántas veces el promedio diario de la semana anterior. */
  spikeFactor: 3,
  /** Los días previos al pico con los que se calcula el promedio. */
  baselineDays: 7,
  /** Cuántos días hacia atrás (contando el pico) sin clic ni postulación. */
  noActionDays: 3,
  /** Días sin ninguna vista para avisar, y antigüedad mínima de la oferta. */
  noVisitsDays: 7,
  /** No repetir la misma alerta de la misma oferta antes de estos días. */
  cooldownDays: 7,
} as const

/** Lo que la detección necesita de una oferta: nada más que contadores. */
export interface OfferSignal {
  id: string
  title: string
  /** Solo las publicadas se vigilan. */
  status: string
  published_at: string
  /** Un punto por día con actividad; los días que faltan valen cero. */
  daily: readonly ({ day: string } & Counts)[]
}

export interface Alert {
  offer_id: string
  title: string
  kind: AlertKind
  /** Una frase con los números que la dispararon. */
  detail: string
}

const sumOver = (offer: OfferSignal, from: string, to: string): Counts => {
  const total: Counts = { views: 0, clicks: 0, applies: 0 }
  for (const point of offer.daily) {
    if (point.day < from || point.day > to) continue
    total.views += point.views
    total.clicks += point.clicks
    total.applies += point.applies
  }
  return total
}

/**
 * Qué alertas corresponden hoy. `today` es el día en que corre el disparador:
 * se mira hasta ayer, que es el último día completo, porque hoy se está
 * contando todavía y un pico a las 7 de la mañana no sería un pico.
 */
export function detectAlerts(
  offers: readonly OfferSignal[],
  today: string,
): Alert[] {
  const yesterday = shiftDay(today, -1)
  const found: Alert[] = []

  for (const offer of offers) {
    if (offer.status !== 'published') continue
    const published = offer.published_at.slice(0, 10)

    /* Sin visitas: la ventana entera tiene que ser posterior a la
       publicación, si no una oferta nueva alertaría por no haber tenido tiempo. */
    const quietFrom = shiftDay(yesterday, -(THRESHOLDS.noVisitsDays - 1))
    if (published !== '' && published <= quietFrom) {
      const seen = sumOver(offer, quietFrom, yesterday)
      if (seen.views === 0) {
        found.push({
          offer_id: offer.id,
          title: offer.title,
          kind: 'no_visits',
          detail: `Nadie la abrió en los últimos ${THRESHOLDS.noVisitsDays} días.`,
        })
        continue
      }
    }

    /* Pico sin acción: ayer contra el promedio de la semana anterior, y nadie
       salió al aviso ni confirmó una postulación en los últimos días. */
    const spike = sumOver(offer, yesterday, yesterday).views
    const baselineTo = shiftDay(yesterday, -1)
    const baselineFrom = shiftDay(baselineTo, -(THRESHOLDS.baselineDays - 1))
    const baseline =
      sumOver(offer, baselineFrom, baselineTo).views / THRESHOLDS.baselineDays
    const actionFrom = shiftDay(yesterday, -(THRESHOLDS.noActionDays - 1))
    const acted = sumOver(offer, actionFrom, yesterday)

    if (
      spike >= THRESHOLDS.spikeMinViews &&
      spike >= Math.max(baseline, 1) * THRESHOLDS.spikeFactor &&
      acted.clicks + acted.applies === 0
    ) {
      found.push({
        offer_id: offer.id,
        title: offer.title,
        kind: 'views_no_applies',
        detail: `Ayer tuvo ${spike} vistas (el promedio de la semana anterior fue ${
          Math.round(baseline * 10) / 10
        }) y nadie salió al aviso en ${THRESHOLDS.noActionDays} días.`,
      })
    }
  }

  return found
}

/* --- preferencia de la empresa --- */

/** Sin fila, las alertas están prendidas: el correo dice cómo apagarlas. */
export function alertsEnabled(companyId: string): boolean {
  const row = db()
    .query<{ enabled: number }, [string]>(
      'SELECT enabled FROM company_alert_settings WHERE company_id = ?',
    )
    .get(companyId)
  return row ? row.enabled === 1 : true
}

export function setAlertsEnabled(
  companyId: string,
  enabled: boolean,
  now: Date = new Date(),
): void {
  db().run(
    `INSERT INTO company_alert_settings (company_id, enabled, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(company_id) DO UPDATE
       SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
    [companyId, enabled ? 1 : 0, now.toISOString()],
  )
}

/* --- qué ya se mandó --- */

/**
 * Reserva la alerta antes de mandarla. Devuelve `false` si esa oferta ya recibió
 * esa clase de alerta dentro del enfriamiento (hoy incluido), así que correr el
 * disparador dos veces el mismo día, o dos días seguidos con la misma
 * situación, no manda nada de más.
 */
function claim(offerId: string, kind: AlertKind, today: string): boolean {
  const since = shiftDay(today, -(THRESHOLDS.cooldownDays - 1))
  const recent = db()
    .query<{ n: number }, [string, string, string]>(
      'SELECT COUNT(*) AS n FROM alert_sent WHERE offer_id = ? AND kind = ? AND day >= ?',
    )
    .get(offerId, kind, since)
  if ((recent?.n ?? 0) > 0) return false

  const result = db().run(
    'INSERT OR IGNORE INTO alert_sent (offer_id, kind, day) VALUES (?, ?, ?)',
    [offerId, kind, today],
  )
  return result.changes === 1
}

/** Si el envío falla, la reserva se suelta para que el próximo día reintente. */
function release(offerId: string, kind: AlertKind, today: string): void {
  db().run(
    'DELETE FROM alert_sent WHERE offer_id = ? AND kind = ? AND day = ?',
    [offerId, kind, today],
  )
}

/** Las marcas viejas no sirven para nada: pasado el enfriamiento, no frenan. */
function prune(today: string): void {
  db().run('DELETE FROM alert_sent WHERE day < ?', [shiftDay(today, -60)])
}

/* --- a quién y qué --- */

/** Los correos verificados de la empresa, sin repetir. El de recuperación se
 * deja afuera: es el de la cuenta y no el de quien lee las métricas. */
export function recipients(companyId: string): string[] {
  const rows = db()
    .query<{ email: string }, [string]>(
      `SELECT DISTINCT email FROM company_emails
        WHERE company_id = ? AND verified = 1 AND kind != 'recovery' AND email != ''
        ORDER BY email`,
    )
    .all(companyId)
  return rows.map((row) => row.email)
}

const KIND_TITLE: Record<AlertKind, string> = {
  views_no_applies: 'Se ve mucho y nadie sale al aviso',
  no_visits: 'No la abre nadie',
}

export function alertMail(
  company: { name: string },
  alerts: readonly Alert[],
  to: string,
): Mail {
  const link = `${publicOrigin()}/empresas`
  const lines = alerts.map(
    (alert) => `- ${alert.title}: ${KIND_TITLE[alert.kind]}. ${alert.detail}`,
  )
  const count = alerts.length
  return {
    to,
    subject:
      count === 1
        ? `JobIt: una oferta de ${company.name} necesita atención`
        : `JobIt: ${count} ofertas de ${company.name} necesitan atención`,
    text: [
      `Hola, estas ofertas de ${company.name} tienen algo para revisar:`,
      '',
      ...lines,
      '',
      `Mirá las métricas y el embudo de cada una en ${link} (sección Métricas).`,
      'Podés apagar estos avisos desde esa misma pantalla.',
      '',
      'Los números son contadores por oferta y por día: JobIt no guarda quién miró cada aviso.',
    ].join('\n'),
  }
}

/* --- el disparador --- */

export interface AlertRun {
  day: string
  companies: number
  /** Alertas que se detectaron y estaban habilitadas. */
  detected: number
  /** Correos que salieron (uno por empresa y destinatario). */
  mails: number
  /** Alertas ya enviadas hace poco, o sin nadie a quien avisarle. */
  skipped: number
}

type Send = (mail: Mail) => Promise<Result<void>>

function signalsOf(companyId: string, today: string): OfferSignal[] {
  const from = shiftDay(
    today,
    -(THRESHOLDS.noVisitsDays + THRESHOLDS.baselineDays + 2),
  )
  const offers = db()
    .query<
      { id: string; title: string; status: string; published_at: string },
      [string]
    >(
      `SELECT id, title, status, published_at FROM offers
        WHERE company_id = ? AND status = 'published'`,
    )
    .all(companyId)

  const daily = db()
    .query<
      { offer_id: string; day: string } & Counts,
      [string, string, string]
    >(
      `SELECT d.offer_id, d.day, d.views, d.clicks, d.applies
         FROM offer_daily d JOIN offers o ON o.id = d.offer_id
        WHERE o.company_id = ? AND d.day >= ? AND d.day <= ?`,
    )
    .all(companyId, from, today)

  const byOffer = new Map<string, ({ day: string } & Counts)[]>()
  for (const row of daily) {
    const list = byOffer.get(row.offer_id) ?? []
    list.push(row)
    byOffer.set(row.offer_id, list)
  }
  return offers.map((offer) => ({
    ...offer,
    daily: byOffer.get(offer.id) ?? [],
  }))
}

/**
 * Corre las alertas de todas las empresas. Es idempotente por día: una oferta
 * que ya recibió esa alerta dentro del enfriamiento no vuelve a avisarse, y un
 * mismo correo sale una sola vez aunque el disparador se ejecute de nuevo.
 * `send` se inyecta para probarlo sin red.
 */
export async function runAlerts(
  now: Date = new Date(),
  send: Send = sendMail,
): Promise<AlertRun> {
  const today = now.toISOString().slice(0, 10)
  const run: AlertRun = {
    day: today,
    companies: 0,
    detected: 0,
    mails: 0,
    skipped: 0,
  }
  prune(today)

  const companies = db()
    .query<{ id: string; name: string }, []>(
      `SELECT DISTINCT c.id, c.name FROM companies c
         JOIN offers o ON o.company_id = c.id AND o.status = 'published'`,
    )
    .all()

  for (const company of companies) {
    if (!alertsEnabled(company.id)) continue
    run.companies += 1

    const found = detectAlerts(signalsOf(company.id, today), today)
    if (found.length === 0) continue
    run.detected += found.length

    const to = recipients(company.id)
    if (to.length === 0) {
      run.skipped += found.length
      continue
    }

    const fresh = found.filter((alert) =>
      claim(alert.offer_id, alert.kind, today),
    )
    run.skipped += found.length - fresh.length
    if (fresh.length === 0) continue

    let delivered = 0
    for (const address of to) {
      const sent = await send(alertMail(company, fresh, address))
      if (sent.ok) delivered += 1
    }
    if (delivered === 0) {
      for (const alert of fresh) release(alert.offer_id, alert.kind, today)
      continue
    }
    run.mails += delivered
  }

  return run
}
