import { fold } from "./catalog.ts";
import { parseDescription } from "./description.ts";
import type { Job } from "./types.ts";

const DAY_NAMES: [string, number][] = [
  ["miercoles", 3],
  ["domingos", 0],
  ["domingo", 0],
  ["viernes", 5],
  ["martes", 2],
  ["jueves", 4],
  ["sabados", 6],
  ["sabado", 6],
  ["lunes", 1],
  ["vier", 5],
  ["lun", 1],
  ["mar", 2],
  ["mie", 3],
  ["jue", 4],
  ["vie", 5],
  ["sab", 6],
  ["dom", 0],
];

const DAY = DAY_NAMES.map(([name]) => name.replace(".", "\\.")).join("|");
const DAY_RE = new RegExp(`(?:${DAY})`, "g");
const DAY_SPAN_RE = new RegExp(`(${DAY})\\s*(?:a|al|hasta)\\s*(${DAY})`);
const CLOCK = String.raw`(\d{1,2})(?:[:.](\d{2}))?`;
const PERIOD = String.raw`(?:\s*(am|pm))`;
const UNIT = String.raw`(?:\s*(?:hs?|hrs?|horas?)\.?)`;
const RANGE_RE = new RegExp(
  `${CLOCK}${PERIOD}?${UNIT}?\\s*(?:a|hasta|-)\\s*${CLOCK}${PERIOD}?${UNIT}?`,
  "g",
);
const WEEKLY_RE = /(\d{1,2}(?:[.,]\d)?)\s*(?:hs?|hrs?|horas?)\.?\s*semanales/;

const dayIndex = (token: string): number | null => {
  const found = DAY_NAMES.find(([name]) => name === token);
  return found ? found[1] : null;
};

/** Inclusive count, wrapping the week: miércoles a lunes is six days. */
const dayCount = (from: number, to: number): number => ((to - from + 7) % 7) + 1;

function clock(
  hour: string,
  minute: string | undefined,
  period: string | undefined,
): number | null {
  let hours = Number(hour);
  const minutes = minute ? Number(minute) : 0;
  if (!Number.isFinite(hours) || hours > 24 || minutes > 59) return null;
  const ampm = period ?? "";
  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;
  return hours + minutes / 60;
}

function duration(start: number, end: number): number | null {
  let hours = end - start;
  if (hours <= 0) hours += 24;
  if (hours > 16) return null;
  return hours;
}

function daysIn(clause: string): number | null {
  const span = clause.match(DAY_SPAN_RE);
  if (span?.[1] && span[2]) {
    const from = dayIndex(span[1]);
    const to = dayIndex(span[2]);
    if (from === null || to === null) return null;
    return dayCount(from, to);
  }
  const singles = clause.match(DAY_RE);
  if (!singles) return null;
  return singles.length;
}

/**
 * Cero cuando el tramo no nombra horas, que es normal y se saltea. Null
 * cuando nombra horas que no se pueden leer: ahí no hay que seguir sumando,
 * porque el total que salga va a ser el de media frase. "8 a 4 y sábados 8 a
 * 12" daba cuatro horas semanales.
 */
function hoursIn(clause: string): number | null {
  const matches = [...clause.matchAll(RANGE_RE)];
  if (matches.length === 0) return 0;
  /** Dos rangos sin día en el medio, separados por "o" o por barra, son dos
   * turnos posibles y no dos tramos del mismo día: se cuenta uno solo. */
  const alternatives = /\so\s|\d\s*o\s*\d|\//.test(clause);
  const ranges = alternatives ? matches.slice(0, 1) : matches;
  let total = 0;
  for (const match of ranges) {
    const start = clock(match[1] ?? "", match[2], match[3]);
    const end = clock(match[4] ?? "", match[5], match[6]);
    if (start === null || end === null) return null;
    const length = duration(start, end);
    if (length === null) return null;
    total += length;
  }
  return total;
}

/**
 * Los tramos se separan con "y", con coma o con barra, y a veces con nada:
 * "Lun a Vie de 9:30 a 18:30 Sab de 10:00 a 14:00". Ese último corte pide que
 * el día que viene traiga su propia hora, porque si no "de 9 a 18 lunes a
 * viernes" quedaría partido en un tramo sin días y otro sin horas, y las horas
 * del primero se perderían.
 */
const CLAUSE_SPLIT = new RegExp(
  `\\s+y\\s+(?=${DAY})|\\s*[,.;/|-]\\s*(?=${DAY})|(?<=\\d${UNIT}?)\\s+(?=(?:${DAY})\\b[^,]*?\\d)`,
);

/**
 * Un turno rotativo, uno "a convenir" o un rango de apertura no describen la
 * semana de nadie, y sin embargo traen horas escritas: multiplicarlas da un
 * número inventado. Mejor no decir nada que decir 80.
 */
const UNCERTAIN =
  /rotativ|a convenir|a definir|a coordinar|a confirmar|flexible|variad|rango|entre las|aprox/;

/**
 * Weekly hours implied by a free-text schedule. Null when the text does not
 * name hours, or names them in a way that is not a timetable (rotating
 * shifts, "a convenir").
 */
export function weeklyHours(text: string): number | null {
  const folded = fold(text)
    .replace(/\blav\b/g, "lunes a viernes")
    .replace(/\ba\.?m\.?\b/g, "am")
    .replace(/\bp\.?m\.?\b/g, "pm")
    /** "Lun. a Vie." abrevia con punto, y el punto corta el "a" del medio. */
    .replace(/\b(lun|mar|mie|jue|vie|sab|dom)\./g, "$1")
    .replace(/\b([lmxjvsd])\./g, "$1")
    /** La abreviatura más común es de una sola letra ("L a V", "S 8 a 12").
     * Se traducen solo estas formas y no la letra suelta, que aparece en
     * cualquier lado y convertiría media descripción en días. */
    .replace(/\bl\s*a\s*v\b/g, "lunes a viernes")
    .replace(/\bl\s*a\s*j\b/g, "lunes a jueves")
    .replace(/\bl\s*a\s*s\b/g, "lunes a sabados")
    .replace(/\bl\s*a\s*d\b/g, "lunes a domingos")
    .replace(/\bs\b\.?(?=\s*[:.]?\s*(?:de\s+)?\d)/g, "sabados")
    .replace(/\bd\b\.?(?=\s*[:.]?\s*(?:de\s+)?\d)/g, "domingos")
    .replace(/\s+/g, " ")
    .trim();
  if (!folded) return null;

  const weekly = folded.match(WEEKLY_RE);
  if (weekly?.[1]) {
    const value = Number(weekly[1].replace(",", "."));
    return Number.isFinite(value) && value > 0 && value <= 84 ? value : null;
  }

  if (UNCERTAIN.test(folded)) return null;

  const clauses = folded.split(CLAUSE_SPLIT);
  let total = 0;
  let previousDays: number | null = null;
  let parsed = false;

  for (const clause of clauses) {
    const hours = hoursIn(clause);
    if (hours === null) return null;
    if (hours === 0) continue;
    const days = daysIn(clause) ?? previousDays ?? (folded.match(DAY_RE) ? null : 5);
    if (days === null) return null;
    previousDays = daysIn(clause) ?? previousDays;
    total += hours * days;
    parsed = true;
  }

  /**
   * Techo más bajo que el del total escrito a mano. Arriba de sesenta ya no
   * hay semana de una persona: es la franja en que el local está abierto y el
   * turno rota adentro ("7:00 a 19:00"). Un total declarado sí se cree, porque
   * eso lo afirma el aviso en vez de deducirlo la multiplicación.
   */
  if (!parsed || total <= 0 || total > 60) return null;
  return Math.round(total * 2) / 2;
}

export function formatWeeklyHours(hours: number): string {
  const label = Number.isInteger(hours) ? String(hours) : String(hours).replace(".", ",");
  return `${label} h semanales`;
}

/** Prefer the dedicated field; fall back to a "Horario:" line in the description. */
export function jobWeeklyHours(job: Job): number | null {
  if (job.schedule) {
    const hours = weeklyHours(job.schedule);
    if (hours !== null) return hours;
  }

  for (const block of parseDescription(job.description)) {
    if (block.kind !== "fields") continue;
    for (const row of block.rows) {
      if (fold(row.label) !== "horario") continue;
      const hours = weeklyHours(row.value);
      if (hours !== null) return hours;
    }
  }

  return null;
}
