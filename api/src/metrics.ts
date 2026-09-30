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
