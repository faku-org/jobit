import { mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { roleOf } from "./roles.ts";
import { type SalarySummary, monthlyPayOf, summarize } from "./salary.ts";
import type { Job } from "./types.ts";

/**
 * El histórico del mercado: una fila por día con el estado del tablero. El
 * informe de mercado es una foto, y sin serie no hay tendencia que calcular;
 * esto es el insumo.
 *
 * Solo agregados. Una fila trae conteos y cuartiles por puesto, rubro y
 * departamento, y nunca una oferta, una empresa ni nada de una persona.
 *
 * Lo escribe el worker y no la API a propósito: la API no se entera del
 * scrapeo (el VPS lo corre por su cuenta y la PC lo sube por la ingesta, dos
 * caminos), y atarle un efecto de escritura a cada uno la acoplaría a algo que
 * no es suyo. Ella solo va a leer el archivo, con `readHistory`.
 */
export interface GroupDay {
  count: number;
  salary: SalarySummary | null;
}

export interface MarketDay {
  /** Día UTC (YYYY-MM-DD) de la corrida: la clave de idempotencia de la fila. */
  day: string;
  scraped_at: string;
  total: number;
  /** Ofertas con un sueldo creíble, de `total`. */
  withSalary: number;
  salary: SalarySummary | null;
  roles: Record<string, GroupDay>;
  categories: Record<string, GroupDay>;
  departments: Record<string, GroupDay>;
}

const DEFAULT_PATH = resolve(import.meta.dir, "../../data/market-history.jsonl");

export const historyFilePath = (): string =>
  process.env.MARKET_HISTORY_FILE ? resolve(process.env.MARKET_HISTORY_FILE) : DEFAULT_PATH;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function salaryOf(jobs: Job[]): SalarySummary | null {
  const values: number[] = [];
  for (const job of jobs) {
    const pay = monthlyPayOf(job);
    if (pay !== null) values.push(pay);
  }
  return summarize(values);
}

function group(jobs: Job[], key: (job: Job) => string | null): Record<string, GroupDay> {
  const buckets = new Map<string, Job[]>();
  for (const job of jobs) {
    const value = key(job);
    if (!value) continue;
    const bucket = buckets.get(value);
    if (bucket) bucket.push(job);
    else buckets.set(value, [job]);
  }

  const out: Record<string, GroupDay> = {};
  for (const [value, bucket] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
    out[value] = { count: bucket.length, salary: salaryOf(bucket) };
  }
  return out;
}

/** La foto del día, sin ninguna referencia a una oferta en particular. */
export function buildMarketDay(jobs: Job[], scrapedAt: string): MarketDay {
  return {
    day: scrapedAt.slice(0, 10),
    scraped_at: scrapedAt,
    total: jobs.length,
    withSalary: jobs.filter((job) => monthlyPayOf(job) !== null).length,
    salary: salaryOf(jobs),
    roles: group(jobs, (job) => roleOf(job.title)?.slug ?? null),
    categories: group(jobs, (job) => job.category || null),
    departments: group(jobs, (job) => job.department),
  };
}

export const serializeDay = (row: MarketDay): string => JSON.stringify(row);

function parseDay(line: string): MarketDay | null {
  try {
    const row = JSON.parse(line) as Partial<MarketDay>;
    return typeof row.day === "string" && DAY.test(row.day) ? (row as MarketDay) : null;
  } catch {
    return null;
  }
}

/** La serie en orden cronológico. Sin archivo, o vacío, es una serie vacía. */
export async function readHistory(path: string = historyFilePath()): Promise<MarketDay[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) return [];

  const rows = (await file.text())
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseDay)
    .filter((row) => row !== null);
  return rows.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Guarda la fila del día. Si ya había una para ese día la reemplaza: dos
 * scrapeos el mismo día (el timer corre cada seis horas) dejan una sola fila, y
 * la que queda es la última, la que mejor dice cómo cerró el día.
 *
 * Reescribe el archivo entero al lado y renombra, igual que la ingesta: un
 * lector que cae en el medio ve el archivo viejo o el nuevo, nunca uno cortado.
 */
export async function recordDay(row: MarketDay, path: string = historyFilePath()): Promise<void> {
  const rows = (await readHistory(path)).filter((existing) => existing.day !== row.day);
  rows.push(row);
  rows.sort((a, b) => a.day.localeCompare(b.day));

  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await Bun.write(temp, `${rows.map(serializeDay).join("\n")}\n`);
  await rename(temp, path);
}
