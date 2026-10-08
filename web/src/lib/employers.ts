import type { Facet } from "./types.ts";

/** La misma normalización que usa la API, para que el slug coincida. */
export const employerSlug = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export interface EmployerTally {
  value: string;
  count: number;
}

export interface EmployerRole {
  slug: string;
  label: string;
  count: number;
}

export interface SalarySummary {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

/** La foto de una empresa, para el stand. */
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
  latest: string[];
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  return (await response.json()) as T;
}

export function fetchEmployers(rubro: string, signal?: AbortSignal): Promise<Facet[]> {
  const params = new URLSearchParams();
  if (rubro) params.set("rubro", rubro);
  return getJson<{ employers: Facet[] }>(`/api/empresas?${params}`, signal).then(
    (body) => body.employers,
  );
}

export const fetchEmployer = (slug: string, signal?: AbortSignal): Promise<EmployerProfile> =>
  getJson<EmployerProfile>(`/api/empresas/${encodeURIComponent(slug)}`, signal);

/** "ACME S.A." y "acme s a" son la misma empresa. */
export const sameEmployer = (one: string, other: string): boolean =>
  employerSlug(one) !== "" && employerSlug(one) === employerSlug(other);
