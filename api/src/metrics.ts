import { db } from "./db.ts";
import type { OfferStatus } from "./offers.ts";

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
export type OfferStatKind = "view" | "apply";

const today = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

/**
 * Suma uno al contador del día. Best-effort a propósito: un id que no es una
 * oferta propia se ignora en vez de romper el lote entero.
 */
export function bump(offerId: string, kind: OfferStatKind, now: Date = new Date()): boolean {
  const column = kind === "view" ? "views" : "applies";
  const exists = db()
    .query<{ id: string }, [string]>("SELECT id FROM offers WHERE id = ?")
    .get(offerId);
  if (!exists) return false;

  db().run(
    `INSERT INTO offer_daily (offer_id, day, ${column}) VALUES (?, ?, 1)
     ON CONFLICT(offer_id, day) DO UPDATE SET ${column} = ${column} + 1`,
    [offerId, today(now)],
  );
  return true;
}

export interface OfferMetrics {
  id: string;
  title: string;
  status: OfferStatus;
  published_at: string;
  views: number;
  applies: number;
}

export interface DailyMetrics {
  day: string;
  views: number;
  applies: number;
}

export interface CompanyMetrics {
  days: number;
  from: string;
  to: string;
  offers: Record<OfferStatus, number>;
  views: number;
  applies: number;
  daily: DailyMetrics[];
  /** Las que más se ven, en la ventana. */
  most_viewed: OfferMetrics[];
  /** Las que más postulaciones juntan, que no siempre son las mismas. */
  most_applied: OfferMetrics[];
}

/** El primer día que entra en una ventana de N días contada desde hoy. */
function windowStart(days: number, now: Date): string {
  const start = new Date(now.getTime() - (Math.max(days, 1) - 1) * 86_400_000);
  return today(start);
}

const countByStatus = (companyId: string): Record<OfferStatus, number> => {
  const rows = db()
    .query<{ status: OfferStatus; n: number }, [string]>(
      "SELECT status, COUNT(*) AS n FROM offers WHERE company_id = ? GROUP BY status",
    )
    .all(companyId);

  const out: Record<OfferStatus, number> = { draft: 0, published: 0, archived: 0 };
  for (const row of rows) if (row.status in out) out[row.status] = row.n;
  return out;
};

/** Todas las ofertas de la empresa con sus contadores dentro de la ventana. */
function offerRows(companyId: string, from: string, to: string): OfferMetrics[] {
  return db()
    .query<
      {
        id: string;
        title: string;
        status: OfferStatus;
        published_at: string;
        views: number;
        applies: number;
      },
      [string, string, string]
    >(
      `SELECT o.id, o.title, o.status, o.published_at,
              COALESCE(SUM(d.views), 0)   AS views,
              COALESCE(SUM(d.applies), 0) AS applies
         FROM offers o
         LEFT JOIN offer_daily d
                ON d.offer_id = o.id AND d.day >= ? AND d.day <= ?
        WHERE o.company_id = ?
        GROUP BY o.id`,
    )
    .all(from, to, companyId);
}

export function companyMetrics(
  companyId: string,
  days = 30,
  now: Date = new Date(),
): CompanyMetrics {
  const from = windowStart(days, now);
  const to = today(now);

  const rows = offerRows(companyId, from, to);
  const totals = rows.reduce(
    (sum, row) => ({ views: sum.views + row.views, applies: sum.applies + row.applies }),
    { views: 0, applies: 0 },
  );

  const daily = db()
    .query<DailyMetrics, [string, string, string]>(
      `SELECT d.day, SUM(d.views) AS views, SUM(d.applies) AS applies
         FROM offer_daily d JOIN offers o ON o.id = d.offer_id
        WHERE o.company_id = ? AND d.day >= ? AND d.day <= ?
        GROUP BY d.day
        ORDER BY d.day`,
    )
    .all(companyId, from, to);

  const mostViewed = [...rows].sort((a, b) => b.views - a.views || b.applies - a.applies);
  const mostApplied = [...rows].sort((a, b) => b.applies - a.applies || b.views - a.views);

  return {
    days,
    from,
    to,
    offers: countByStatus(companyId),
    views: totals.views,
    applies: totals.applies,
    daily,
    most_viewed: mostViewed.slice(0, 5),
    most_applied: mostApplied.slice(0, 5),
  };
}

/**
 * Lo mismo para servicios. `service_daily` suma por servicio y por día; no hay
 * columna de persona y el servidor no la recibe, así que no hay nada que cruzar
 * ni siquiera si mañana existe la sesión.
 */
export type ServiceStatKind = "view" | "contact";

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
  const column = kind === "view" ? "views" : "contacts";
  const exists = db()
    .query<{ category: string }, [string]>(
      "SELECT category FROM services WHERE id = ? AND status = 'published'",
    )
    .get(serviceId);
  if (!exists) return null;

  db().run(
    `INSERT INTO service_daily (service_id, day, ${column}) VALUES (?, ?, 1)
     ON CONFLICT(service_id, day) DO UPDATE SET ${column} = ${column} + 1`,
    [serviceId, today(now)],
  );
  return exists.category;
}

export interface ServiceMetrics {
  id: string;
  title: string;
  views: number;
  contacts: number;
  daily: DailyServiceMetrics[];
}

export interface DailyServiceMetrics {
  day: string;
  views: number;
  contacts: number;
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
      "SELECT id, title FROM services WHERE id = ? AND user_id = ?",
    )
    .get(serviceId, userId);
  if (!service) return null;

  const daily = db()
    .query<DailyServiceMetrics, [string, string, string]>(
      `SELECT day, views, contacts FROM service_daily
        WHERE service_id = ? AND day >= ? AND day <= ?
        ORDER BY day`,
    )
    .all(serviceId, windowStart(days, now), today(now));

  return {
    id: service.id,
    title: service.title,
    views: daily.reduce((sum, row) => sum + row.views, 0),
    contacts: daily.reduce((sum, row) => sum + row.contacts, 0),
    daily,
  };
}

/** Una fila por servicio publicado, con lo que sumó en la ventana. */
export interface ServiceDailyRow {
  service_id: string;
  title: string;
  category: string;
  views: number;
  contacts: number;
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
    .all(from, to);
}
