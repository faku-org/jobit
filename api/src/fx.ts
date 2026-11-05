/**
 * La única tasa que el sistema necesita, y solo para una cosa: ordenar por
 * precio cuando la lista mezcla pesos y dólares. Nada se convierte al guardar,
 * porque un precio convertido es un precio que la persona no publicó.
 *
 * La tasa se configura a mano:
 *
 *   USD_UYU=41.5
 *
 * Es a propósito. Salir a buscarla sola metería una dependencia de red en una
 * lista que hoy no la tiene, y una tasa vieja mentiría con más confianza que
 * no tener ninguna. Si falta, el orden por precio se apaga en vez de mentir.
 */
export interface Rate {
  usd_uyu: number;
  /** El día en que se leyó, para poder decir de cuándo es. */
  day: string;
  /** Siempre: es una tasa sola para ordenar, no una cotización. */
  approximate: true;
}

const MIN_RATE = 1;
const MAX_RATE = 1000;

export function usdRate(now: Date = new Date()): Rate | null {
  const raw = Number((process.env.USD_UYU ?? "").trim());
  if (!Number.isFinite(raw) || raw < MIN_RATE || raw > MAX_RATE) return null;

  return { usd_uyu: raw, day: now.toISOString().slice(0, 10), approximate: true };
}

/** Lo que vale ese monto en pesos, para comparar contra otro. */
export const inPesos = (amount: number, currency: string, rate: Rate | null): number | null => {
  if (currency === "UYU") return amount;
  if (!rate) return null;
  return Math.round(amount * rate.usd_uyu);
};
