export const COMPANY_STATUSES = ["pending", "approved", "suspended"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobada",
  suspended: "Suspendida",
};

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  /** Que el correo de contacto de hoy es uno que alguien de la empresa lee. */
  email_verified: boolean;
  website: string;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
}

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

export interface OfferInput {
  title: string;
  description?: string;
  requirements?: string;
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

export interface OfferMetrics {
  id: string;
  title: string;
  status: OfferStatus;
  published_at: string;
  views: number;
  applies: number;
}

export interface Metrics {
  days: number;
  from: string;
  to: string;
  offers: Record<OfferStatus, number>;
  views: number;
  applies: number;
  daily: { day: string; views: number; applies: number }[];
  most_viewed: OfferMetrics[];
  most_applied: OfferMetrics[];
}

/** La sesión vencida no es un error a mostrar, es volver a la pantalla de
 * entrada, así que se distingue del resto. */
export class Unauthorized extends Error {}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/empresas${path}`, {
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

export interface SessionInfo {
  status: string;
  company: Company;
}

export const checkSession = (): Promise<SessionInfo> => send("/session");

export const login = (identifier: string, password: string): Promise<SessionInfo> =>
  send("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });

export const register = (input: {
  name: string;
  email: string;
  website?: string;
  password: string;
}): Promise<SessionInfo> => send("/auth/register", { method: "POST", body: JSON.stringify(input) });

export const logout = (): Promise<{ status: string }> => send("/auth/logout", { method: "POST" });

/** Contesta lo mismo exista o no la empresa: no sirve para saber quién está. */
export const requestReset = (identifier: string): Promise<{ message: string }> =>
  send("/auth/recover", { method: "POST", body: JSON.stringify({ identifier }) });

export const resendVerification = (): Promise<{ verified: boolean }> =>
  send("/me/email/verify", { method: "POST", body: "{}" });

/** El reset vive en /api/auth porque el enlace es el mismo para personas y
 * empresas: el token sabe de qué cuenta es. */
export async function resetPassword(token: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/reset", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `La API respondió ${response.status}`);
  }
}

export const getMetrics = (days: number): Promise<Metrics> => send(`/metrics?days=${days}`);

export const listOffers = (): Promise<{ offers: Offer[]; counts: Record<OfferStatus, number> }> =>
  send("/offers");

export const createOffer = (input: OfferInput): Promise<Offer> =>
  send("/offers", { method: "POST", body: JSON.stringify(input) });

export const updateOffer = (id: string, input: Partial<OfferInput>): Promise<Offer> =>
  send(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteOffer = (id: string): Promise<{ status: string }> =>
  send(`/offers/${id}`, { method: "DELETE" });

export const updateCompany = (input: {
  name?: string;
  email?: string;
  website?: string;
  current_password?: string;
  new_password?: string;
}): Promise<{ company: Company }> => send("/me", { method: "PATCH", body: JSON.stringify(input) });

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
