import { type CustomFeed, MAX_FEEDS } from "./feed.ts";
import type { Profile } from "./profile.ts";
import { type Application, type Preferences, type SalaryPreference } from "./types.ts";

/**
 * Lo que viaja entre navegadores cuando el sync está prendido.
 *
 * Deja afuera lo que es de este navegador y de nadie más: el tema, la marca de
 * la intro y la fecha del último resumen anónimo. El resto —lo guardado, lo
 * descartado, las postulaciones, las preferencias, el perfil y las fuentes
 * propias— sigue a la cuenta.
 */
export interface SyncedState {
  saved: string[];
  dismissed: string[];
  preferences: Preferences;
  applications: Application[];
  sources: string[];
  feeds: CustomFeed[];
  /** Empresas donde trabajó la persona, por slug. */
  companies: string[];
  profile: Profile;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

async function send<T>(path: string, init: RequestInit = {}): Promise<Outcome<T>> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const error =
      typeof body?.error === "string" ? body.error : `La API respondió ${response.status}`;
    return { ok: false, error };
  }
  return { ok: true, value: body as T };
}

export interface RemoteSync {
  enabled: boolean;
  payload: unknown;
  updated_at: string;
}

export const pullSync = (): Promise<Outcome<RemoteSync>> => send<RemoteSync>("/api/me/sync");

export const pushSync = (payload: SyncedState): Promise<Outcome<unknown>> =>
  send("/api/me/sync", { method: "PUT", body: JSON.stringify({ payload }) });

export const disableSync = (): Promise<Outcome<unknown>> =>
  send("/api/me/sync", { method: "DELETE" });

const union = <T extends string>(one: T[], other: T[]): T[] => [...new Set([...one, ...other])];

/** Lo local manda cuando el mismo id está en los dos lados. */
function mergeApplications(local: Application[], remote: Application[]): Application[] {
  const known = new Set(local.map((entry) => entry.id));
  return [...local, ...remote.filter((entry) => !known.has(entry.id))];
}

function mergeFeeds(local: CustomFeed[], remote: CustomFeed[]): CustomFeed[] {
  const known = new Map(local.map((feed) => [feed.id, feed]));
  for (const feed of remote) if (!known.has(feed.id)) known.set(feed.id, feed);
  return [...known.values()].slice(0, MAX_FEEDS);
}

/** Los títulos y cursos son un catálogo acotado: la unión no puede crecer sin
 * control. */
const CATALOG_MAX = 20;

/** El sueldo pide una decisión: un navegador con rango le gana al que dejó los
 * valores por defecto. */
const hasSalary = (salary: SalaryPreference): boolean =>
  salary.min !== null || salary.max !== null || salary.includeUnknown === false;

function mergeProfile(local: Profile, remote: Profile): Profile {
  return {
    education: local.education !== "" ? local.education : remote.education,
    degrees: union(local.degrees, remote.degrees).slice(0, CATALOG_MAX),
    courses: union(local.courses, remote.courses).slice(0, CATALOG_MAX),
    experienceYears: local.experienceYears ?? remote.experienceYears,
    /** Compartir es privacidad: si en alguno de los dos está apagado, gana el
     * apagado. */
    shareStats: local.shareStats && remote.shareStats,
    onboardedAt: local.onboardedAt !== "" ? local.onboardedAt : remote.onboardedAt,
  };
}

/**
 * Campo por campo: lo que se elige de a uno deja ganar al navegador que estás
 * mirando, salvo cuando este todavía está en el valor por defecto, que es
 * cuando manda lo que ya había en la cuenta.
 */
function mergePreferences(local: Preferences, remote: Preferences): Preferences {
  const hiddenCategories = union(local.hiddenCategories, remote.hiddenCategories);
  const hiddenDepartments = union(local.hiddenDepartments, remote.hiddenDepartments);
  const wanted = (one: string[], other: string[], hidden: string[]): string[] =>
    (one.length > 0 ? one : other).filter((value) => !hidden.includes(value));

  return {
    modes: union(local.modes, remote.modes),
    jobTypes: union(local.jobTypes, remote.jobTypes),
    levels: union(local.levels, remote.levels),
    hiddenCategories,
    hiddenDepartments,
    categories: wanted(local.categories, remote.categories, hiddenCategories),
    departments: wanted(local.departments, remote.departments, hiddenDepartments),
    salary: hasSalary(local.salary) ? local.salary : remote.salary,
    rankByFit: local.rankByFit === false ? false : remote.rankByFit,
    mix: local.mix === "balanced" ? remote.mix : local.mix,
  };
}

/**
 * Mezcla lo de este navegador con lo que ya estaba en la cuenta. Lo que se
 * acumula se une; lo que se elige de a uno se mezcla campo por campo, dejando
 * ganar a este navegador cuando los dos tienen algo que decir.
 */
export function mergeSynced(local: SyncedState, remote: SyncedState): SyncedState {
  const saved = union(local.saved, remote.saved);
  const savedSet = new Set(saved);
  return {
    saved,
    /** Guardadas y descartadas son respuestas opuestas: gana guardada. */
    dismissed: union(local.dismissed, remote.dismissed).filter((id) => !savedSet.has(id)),
    applications: mergeApplications(local.applications, remote.applications),
    feeds: mergeFeeds(local.feeds, remote.feeds),
    companies: [...new Set([...local.companies, ...remote.companies])],
    sources: local.sources.length > 0 ? local.sources : remote.sources,
    preferences: mergePreferences(local.preferences, remote.preferences),
    profile: mergeProfile(local.profile, remote.profile),
  };
}
