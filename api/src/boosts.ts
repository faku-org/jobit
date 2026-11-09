import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Visibilidad destacada. Publicar es gratis y va a seguir siéndolo: lo que
 * eventualmente se cobra es aparecer antes en la lista.
 *
 * Reglas que este archivo sostiene, y que los tests fijan:
 *
 * - Un destacado nunca va camuflado. `featured` viaja en la respuesta pública
 *   y la web lo dice con la palabra "Destacado" en la tarjeta y en la ficha.
 * - Pagar mueve a un servicio de grupo, no lo mejora dentro del grupo: el
 *   orden dentro de destacados y dentro de no destacados es el mismo de
 *   siempre. Un destacado malo no le gana a un buen servicio por pagar, solo
 *   aparece antes.
 * - Un destacado vence solo, por fecha. No hay trabajo en segundo plano que
 *   tenga que acordarse de apagarlo.
 *
 * Quién otorga: por ahora el admin, a mano. No hay cobro todavía; cuando lo
 * haya, el que otorga será un pago confirmado (ver payments.ts) y no cambia
 * nada de lo que hay acá.
 */
export const BOOST_KINDS = ["featured"] as const;
export type BoostKind = (typeof BOOST_KINDS)[number];

/** Cuánto se puede otorgar de una vez y cuánto puede quedar acumulado. */
export const MAX_GRANT_DAYS = 90;
export const MAX_TOTAL_DAYS = 365;

const DAY_MS = 86_400_000;

const day = (now: Date): string => now.toISOString().slice(0, 10);

const addDays = (from: string, days: number): string =>
  day(new Date(new Date(`${from}T00:00:00Z`).getTime() + days * DAY_MS));

/**
 * Los días son YYYY-MM-DD y se comparan como texto, igual que en el resto de
 * las tablas. `until` es inclusive: un destacado hasta el 10 se ve todo el 10.
 */
export const isBoosted = (
  boost: { boost_until: string; status: string },
  now: Date = new Date(),
): boolean => boost.status === "published" && boost.boost_until >= day(now);

interface BoostRow {
  status: string;
  boost_until: string;
  boost_kind: string;
}

const rowOf = (serviceId: string): BoostRow | null =>
  db()
    .query<BoostRow, [string]>("SELECT status, boost_until, boost_kind FROM services WHERE id = ?")
    .get(serviceId) ?? null;

export interface Boost {
  service_id: string;
  kind: BoostKind;
  until: string;
}

/**
 * Suma `days` días. Si ya hay uno vigente, se suma al final y no desde hoy:
 * quien extiende no pierde lo que le quedaba. Hoy cuenta como el primer día.
 */
export function grant(
  serviceId: string,
  kind: BoostKind,
  days: number,
  now: Date = new Date(),
): Result<Boost> {
  if (!Number.isInteger(days) || days < 1 || days > MAX_GRANT_DAYS) {
    return { ok: false, error: `los días van de 1 a ${MAX_GRANT_DAYS}` };
  }

  const current = rowOf(serviceId);
  if (!current) return { ok: false, error: "ese servicio no existe" };

  const today = day(now);
  const base = current.boost_until >= today ? current.boost_until : addDays(today, -1);
  const until = addDays(base, days);

  if (until > addDays(today, MAX_TOTAL_DAYS)) {
    return {
      ok: false,
      error: `un servicio no puede estar destacado más de ${MAX_TOTAL_DAYS} días`,
    };
  }

  db().run("UPDATE services SET boost_until = ?, boost_kind = ? WHERE id = ?", [
    until,
    kind,
    serviceId,
  ]);
  return { ok: true, value: { service_id: serviceId, kind, until } };
}

/** Apagarlo no deja rastro: sin fecha y sin clase es "no destacado". */
export const revoke = (serviceId: string): boolean =>
  db().run("UPDATE services SET boost_until = '', boost_kind = '' WHERE id = ?", [serviceId])
    .changes > 0;

/** Los vigentes ahora, para que el admin vea qué está sonando como destacado. */
export function active(now: Date = new Date()): Boost[] {
  return db()
    .query<{ service_id: string; kind: BoostKind; until: string }, [string]>(
      `SELECT id AS service_id, boost_kind AS kind, boost_until AS until
         FROM services
        WHERE status = 'published' AND boost_until >= ?
        ORDER BY boost_until, id`,
    )
    .all(day(now));
}
