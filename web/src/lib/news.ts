import { JOB_TYPE_LABEL, LEVEL_LABEL, WORK_MODE_LABEL } from "./format.ts";
import type { MarketReport } from "./market.ts";
import type { Profile } from "./profile.ts";
import { type Job, type Preferences, matchesPreferences, workMode } from "./types.ts";

/**
 * Lo que se arma para la sección de novedades. Todo sale de datos que ya
 * existen —el tablero público, el informe de mercado y lo que la persona tiene
 * guardado en su navegador—; acá no se redacta contenido ni se inventa una
 * tendencia. Es puro: recibe listas y devuelve bloques, así se prueba sin red.
 */

const DAY_MS = 86_400_000;

/** Hasta cuántos días una oferta cuenta como "nueva". */
const FRESH_DAYS = 3;
/** La ventana de cierres que vale la pena avisar. */
const CLOSING_DAYS = 14;
/** Techo de recomendaciones por bloque, para no convertir esto en otra lista. */
const MAX_MATCHES = 4;
const MAX_STARTERS = 4;
const MAX_CLOSINGS = 5;
/** Cuántas ofertas del bloque reciente se miran al armar los bloques. */
const SCAN = 40;

export interface NewsMatch {
  job: Job;
  /** Por qué encaja, en datos: el rubro, la zona, la modalidad. */
  reasons: string[];
  /** Publicada en los últimos días. */
  fresh: boolean;
}

export interface NewsClosing {
  job: Job;
  daysLeft: number;
}

export interface MarketNews {
  fresh7: number;
  median: number | null;
  /** Total del tablero, para expresar cada rubro como parte del todo. */
  total: number;
  topCategories: { value: string; label: string; count: number }[];
}

export interface News {
  matches: NewsMatch[];
  starters: NewsMatch[];
  closings: NewsClosing[];
  market: MarketNews | null;
  /**
   * El histórico de mercado es otra pieza (la serie diaria). Sin dos puntos no
   * hay tendencia, y este bloque se calla en vez de extrapolar de la nada.
   */
  hasHistory: boolean;
}

const daysSince = (iso: string, now: number): number | null => {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : Math.floor((now - at) / DAY_MS);
};

/** Quien recién arranca: sin años cargados o con uno o menos. */
export const isEntryProfile = (profile: Profile): boolean =>
  profile.experienceYears === null || profile.experienceYears <= 1;

/**
 * Por qué esta oferta entra en "Para vos", leído de las preferencias. Sin
 * ninguna razón concreta no se recomienda: mejor vacío que un "coincide con tu
 * búsqueda" que no dice nada.
 */
export function matchReasons(job: Job, preferences: Preferences): string[] {
  const reasons: string[] = [];
  const mode = workMode(job);

  if (preferences.categories.includes(job.category)) {
    reasons.push(`En tu rubro: ${job.category_label}`);
  }
  if (job.department && preferences.departments.includes(job.department)) {
    reasons.push(`En ${job.department}`);
  }
  if (preferences.modes.includes(mode)) reasons.push(WORK_MODE_LABEL[mode]);
  if (job.level && preferences.levels.includes(job.level)) reasons.push(LEVEL_LABEL[job.level]);
  if (job.job_type && preferences.jobTypes.includes(job.job_type)) {
    reasons.push(JOB_TYPE_LABEL[job.job_type]);
  }

  return reasons;
}

/** Por qué una práctica o una oferta sin experiencia sirve para arrancar. */
function starterReasons(job: Job): string[] {
  const reasons: string[] = [];
  if (job.job_type === "internship") reasons.push("Pasantía");
  if (job.no_experience) reasons.push("No piden experiencia");
  return reasons;
}

function marketNews(report: MarketReport | null): MarketNews | null {
  if (!report) return null;

  return {
    fresh7: report.fresh7,
    median: report.salary?.median ?? null,
    total: report.count,
    topCategories: report.categories.slice(0, 4).map((category) => ({
      value: category.value,
      label: category.label,
      count: category.count,
    })),
  };
}

interface BuildInput {
  /** El tablero reciente, ya ordenado por encaje. */
  jobs: Job[];
  /** Las ofertas que la persona sigue (guardadas o postuladas). */
  followed: Job[];
  preferences: Preferences;
  market: MarketReport | null;
  now?: number;
}

export function buildNews({
  jobs,
  followed,
  preferences,
  market,
  now = Date.now(),
}: BuildInput): News {
  const available = jobs.slice(0, SCAN);

  const matches: NewsMatch[] = [];
  const starters: NewsMatch[] = [];

  for (const job of available) {
    const age = daysSince(job.date_posted, now);
    const fresh = age !== null && age <= FRESH_DAYS;

    if (matches.length < MAX_MATCHES && matchesPreferences(job, preferences)) {
      const reasons = matchReasons(job, preferences);
      if (reasons.length > 0) matches.push({ job, reasons, fresh });
    }

    if (starters.length < MAX_STARTERS) {
      const reasons = starterReasons(job);
      if (reasons.length > 0) starters.push({ job, reasons, fresh });
    }
  }

  return {
    matches,
    starters,
    closings: following(followed, now),
    market: marketNews(market),
    /** Hasta que exista la serie de mercado, no hay tendencia que mostrar. */
    hasHistory: false,
  };
}

/** Cierres próximos de lo que la persona sigue, del más urgente al más lejano. */
function following(followed: Job[], now: number): NewsClosing[] {
  return followed
    .flatMap((job) => {
      if (!job.closes_at) return [];
      const closes = Date.parse(job.closes_at);
      if (Number.isNaN(closes)) return [];
      const daysLeft = Math.ceil((closes - now) / DAY_MS);
      return daysLeft < 0 || daysLeft > CLOSING_DAYS ? [] : [{ job, daysLeft }];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, MAX_CLOSINGS);
}
