export const COMPANY_STATUSES = ["pending", "approved", "suspended"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const STATUS_LABEL: Record<CompanyStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  suspended: "Suspendida",
};

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  website: string;
  status: CompanyStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type Counts = Record<CompanyStatus, number>;

export interface CompanyList {
  companies: Company[];
  counts: Counts;
}

export interface CompanyInput {
  name: string;
  email?: string;
  website?: string;
  status?: CompanyStatus;
  notes?: string;
}

/** La sesión vencida no es un error a mostrar, es volver a la pantalla de
 * entrada, así que se distingue del resto. */
export class Unauthorized extends Error {}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (response.status === 401) throw new Unauthorized("sesión vencida");

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `La API respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

export const checkSession = (): Promise<{ status: string }> => send("/session");

export const login = (password: string): Promise<{ status: string }> =>
  send("/login", { method: "POST", body: JSON.stringify({ password }) });

export const logout = (): Promise<{ status: string }> => send("/logout", { method: "POST" });

export function listCompanies(status: CompanyStatus | "", q: string): Promise<CompanyList> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  const query = params.toString();
  return send(`/companies${query ? `?${query}` : ""}`);
}

export const createCompany = (input: CompanyInput): Promise<Company> =>
  send("/companies", { method: "POST", body: JSON.stringify(input) });

export const updateCompany = (id: string, input: Partial<CompanyInput>): Promise<Company> =>
  send(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteCompany = (id: string): Promise<{ status: string }> =>
  send(`/companies/${id}`, { method: "DELETE" });

export const OFFER_STATUSES = ["draft", "published", "archived"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

export interface Offer {
  id: string;
  company_id: string;
  company_name: string;
  company_status: CompanyStatus;
  title: string;
  description: string;
  requirements: string;
  category: string;
  department: string;
  city: string;
  level: string;
  remote: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  no_experience: boolean;
  closes_at: string;
  apply_url: string;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
  published_at: string;
}

export interface OfferList {
  offers: Offer[];
  counts: Record<OfferStatus, number>;
}

export interface OfferInput {
  company_id: string;
  title: string;
  description?: string;
  category?: string;
  department?: string;
  city?: string;
  level?: string;
  remote?: string;
  job_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  no_experience?: boolean;
  closes_at?: string;
  apply_url?: string;
  status?: OfferStatus;
}

export function listOffers(status: OfferStatus | ""): Promise<OfferList> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const query = params.toString();
  return send(`/offers${query ? `?${query}` : ""}`);
}

export const createOffer = (input: OfferInput): Promise<Offer> =>
  send("/offers", { method: "POST", body: JSON.stringify(input) });

export const updateOffer = (id: string, input: Partial<OfferInput>): Promise<Offer> =>
  send(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteOffer = (id: string): Promise<{ status: string }> =>
  send(`/offers/${id}`, { method: "DELETE" });

/** Las mismas del catálogo del worker, que es lo que la API acepta. */
export const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "ventas", label: "Ventas y comercial" },
  { slug: "atencion-cliente", label: "Atención al cliente" },
  { slug: "administracion", label: "Administración y gestión" },
  { slug: "oficios", label: "Oficios y construcción" },
  { slug: "produccion", label: "Producción e industria" },
  { slug: "logistica", label: "Logística y distribución" },
  { slug: "contabilidad-finanzas", label: "Contabilidad y finanzas" },
  { slug: "tecnologia", label: "Tecnología" },
  { slug: "datos-analisis", label: "Análisis e investigación" },
  { slug: "salud", label: "Salud" },
  { slug: "ingenieria", label: "Ingeniería" },
  { slug: "marketing", label: "Marketing y publicidad" },
  { slug: "rrhh", label: "Recursos humanos" },
  { slug: "educacion", label: "Educación" },
  { slug: "diseno", label: "Diseño y creatividad" },
  { slug: "otros", label: "Otros" },
];
