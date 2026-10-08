import { roleOf } from "@jobit/worker/roles";
import { type SalarySummary, monthlyPayOf, summarize } from "./market.ts";
import type { Job } from "./types.ts";

/**
 * Las empresas son una vista sobre el tablero, no una tabla: salen del campo
 * `company` de las ofertas que junta el worker. No hay estado nuevo.
 *
 * El nombre llega sucio —mayúsculas, espacios dobles, sufijos societarios—, así
 * que se agrupa por una clave sin acentos ni mayúsculas, se muestra la forma
 * más repetida y se guarda un slug estable para la URL y el filtro.
 */
export function employerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function employerSlug(name: string): string {
  return employerKey(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface EmployerGroup {
  slug: string;
  names: Map<string, number>;
  jobs: Job[];
}

function groupEmployers(jobs: Job[]): EmployerGroup[] {
  const groups = new Map<string, EmployerGroup>();

  for (const job of jobs) {
    const name = job.company?.trim();
    if (!name) continue;
    const key = employerKey(name);
    if (key === "") continue;

    let entry = groups.get(key);
    if (!entry) {
      entry = { slug: employerSlug(name), names: new Map(), jobs: [] };
      groups.set(key, entry);
    }
    entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
    entry.jobs.push(job);
  }

  return [...groups.values()];
}

/** El nombre que más se repite; en empate, el más corto. */
function displayName(names: Map<string, number>): string {
  const [best] = [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  return best?.[0] ?? "";
}

export interface EmployerFacet {
  value: string;
  label: string;
  count: number;
}

/** Las empresas de un rubro (o de todo el tablero), para el selector. */
export function employerFacets(
  jobs: Job[],
  category: string | undefined,
  limit = 100,
): EmployerFacet[] {
  const scoped = category ? jobs.filter((job) => job.category === category) : jobs;

  return groupEmployers(scoped)
    .map((entry) => ({
      value: entry.slug,
      label: displayName(entry.names),
      count: entry.jobs.length,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export interface EmployerTally {
  value: string;
  count: number;
}

export interface EmployerRole {
  slug: string;
  label: string;
  count: number;
}

export interface EmployerProfile {
  value: string;
  label: string;
  count: number;
  noExperience: number;
  withSalary: number;
  salary: SalarySummary | null;
  roles: EmployerRole[];
  categories: { value: string; label: string; count: number }[];
  departments: EmployerTally[];
  modes: EmployerTally[];
  jobTypes: EmployerTally[];
  levels: EmployerTally[];
  /** Los ids de las últimas ofertas, para enlazar desde el stand. */
  latest: string[];
}

function tally(jobs: Job[], pick: (job: Job) => string | null): EmployerTally[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = pick(job);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

const LATEST_LIMIT = 12;

/** La ficha de una empresa: su foto y sus últimas ofertas. */
export function employerProfile(jobs: Job[], slug: string): EmployerProfile | null {
  const entry = groupEmployers(jobs).find((candidate) => candidate.slug === slug);
  if (!entry) return null;

  const own = entry.jobs;
  const salaries = own.flatMap((job) => {
    const pay = monthlyPayOf(job);
    return pay === null ? [] : [pay];
  });

  const roleCounts = new Map<string, EmployerRole>();
  for (const job of own) {
    const role = roleOf(job.title);
    if (!role) continue;
    const current = roleCounts.get(role.slug);
    if (current) current.count++;
    else roleCounts.set(role.slug, { slug: role.slug, label: role.label, count: 1 });
  }

  const categoryCounts = new Map<string, { label: string; count: number }>();
  for (const job of own) {
    const current = categoryCounts.get(job.category);
    if (current) current.count++;
    else categoryCounts.set(job.category, { label: job.category_label, count: 1 });
  }

  return {
    value: entry.slug,
    label: displayName(entry.names),
    count: own.length,
    noExperience: own.filter((job) => job.no_experience).length,
    withSalary: salaries.length,
    salary: summarize(salaries),
    roles: [...roleCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    categories: [...categoryCounts.entries()]
      .map(([value, data]) => ({ value, label: data.label, count: data.count }))
      .sort((a, b) => b.count - a.count),
    departments: tally(own, (job) => job.department),
    modes: tally(own, (job) => job.remote ?? "onsite"),
    jobTypes: tally(own, (job) => job.job_type),
    levels: tally(own, (job) => job.level),
    latest: [...own]
      .sort((a, b) => b.date_posted.localeCompare(a.date_posted))
      .slice(0, LATEST_LIMIT)
      .map((job) => job.id),
  };
}
