import type { JobType, Level, Salary, WorkMode } from "./types.ts";

const DAY_MS = 86_400_000;

export const LEVEL_LABEL: Record<Level, string> = {
  entry: "Junior",
  mid: "Semi senior",
  senior: "Senior",
};

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  onsite: "Presencial",
  remote: "Remoto",
  hybrid: "Híbrido",
};

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  full_time: "Jornada completa",
  part_time: "Medio horario",
  internship: "Pasantía",
};

export const SOURCE_LABEL: Record<string, string> = {
  buscojobs: "BuscoJobs",
  gallito: "Gallito",
};

/** "hoy", "ayer", "hace 5 días", "hace 3 semanas". */
export function relativeDate(iso: string, now: number = Date.now()): string {
  const posted = Date.parse(iso);
  if (Number.isNaN(posted)) return "";

  const days = Math.max(Math.floor((now - posted) / DAY_MS), 0);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "hace 1 semana";
  if (days < 30) return `hace ${weeks} semanas`;

  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

export function formatScrapedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const money = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

export function formatSalary(salary: Salary | null): string | null {
  if (!salary) return null;
  const symbol = salary.currency === "USD" ? "US$" : "$";
  if (salary.min && salary.max) {
    return `${symbol} ${money.format(salary.min)} a ${money.format(salary.max)}`;
  }
  const single = salary.min ?? salary.max;
  return single ? `${symbol} ${money.format(single)}` : null;
}

export function formatLocation(city: string | null, department: string | null): string {
  if (city && department && city !== department) return `${city}, ${department}`;
  return city ?? department ?? "Uruguay";
}

export const pluralOffers = (total: number): string =>
  total === 1 ? "1 oferta" : `${new Intl.NumberFormat("es-UY").format(total)} ofertas`;
