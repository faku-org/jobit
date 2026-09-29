export const COMPANY_STATUSES = ["pending", "approved", "suspended"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobada",
  suspended: "Suspendida",
};

export const SOCIAL_NETWORKS = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
  "whatsapp",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export const EMAIL_KINDS = ["billing", "contact", "support", "recovery"] as const;
export type CompanyEmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_KIND_LABEL: Record<CompanyEmailKind, string> = {
  billing: "Facturación",
  contact: "Contacto",
  support: "Soporte",
  recovery: "Recuperación",
};

export const EMAIL_KIND_HINT: Record<CompanyEmailKind, string> = {
  billing: "Donde te llegan las facturas.",
  contact: "El primero que ve la gente. Puede ser el mismo del alta.",
  support: "Al que escribe quien necesita ayuda.",
  recovery: "El alterno para recuperar la cuenta si perdés el acceso.",
};

export interface CompanyEmail {
  kind: CompanyEmailKind;
  email: string;
  verified: boolean;
  updated_at: string;
}

export interface CompanyMember {
  user_id: string;
  handle: string;
  display_name: string;
  created_at: string;
}

export interface Privacy {
  phone: boolean;
  email: boolean;
  website: boolean;
  members: boolean;
}

export const PRIVACY_LABEL: Record<keyof Privacy, { label: string; hint: string }> = {
  phone: { label: "Teléfono", hint: "El número de contacto." },
  email: { label: "Correo de contacto", hint: "El correo público de la empresa." },
  website: { label: "Sitio web", hint: "Solo si el dominio está verificado." },
  members: { label: "Miembros", hint: "Quiénes de JobIt forman parte de la empresa." },
};

export interface WebsiteVerification {
  host: string;
  record_name: string;
  record_value: string;
  verified: boolean;
  checked_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  website: string;
  phone: string;
  phone_country: string;
  logo: string;
  banner: string;
  socials: Partial<Record<SocialNetwork, string>>;
  privacy: Privacy;
  website_verification: WebsiteVerification | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
  totp_enabled: boolean;
  recovery_codes_left: number;
  emails: CompanyEmail[];
  members: CompanyMember[];
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
  /** El multipart lo arma el navegador: si le ponemos el content-type, deja de
   * llevar el boundary y el archivo no llega. */
  const isForm = init.body instanceof FormData;
  const response = await fetch(`/api/empresas${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
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

/** El desafío del segundo paso: todavía no hay sesión, hay que poner el código. */
export interface Challenge {
  status: "totp_required" | "totp_setup_required";
  company: Company;
}

export interface TotpSetup {
  status: "setup";
  account: string;
  secret: string;
  otpauth: string;
}

export interface TotpDone {
  status: "ok";
  company: Company;
  recovery_codes?: string[];
}

export const checkSession = (): Promise<SessionInfo> => send("/session");

export const register = (input: {
  name: string;
  email: string;
  website?: string;
  phone?: string;
  phone_country?: string;
  password: string;
  recovery_email?: string;
}): Promise<Challenge> => send("/auth/register", { method: "POST", body: JSON.stringify(input) });

export const login = (identifier: string, password: string): Promise<Challenge> =>
  send("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });

/** Arranca la activación del segundo paso: devuelve el secreto para el QR. */
export const startTotpSetup = (): Promise<TotpSetup> =>
  send("/auth/totp/setup", { method: "POST", body: JSON.stringify({}) });

export const confirmTotpSetup = (code: string): Promise<TotpDone> =>
  send("/auth/totp/setup", { method: "POST", body: JSON.stringify({ code }) });

export const submitTotp = (code: string): Promise<TotpDone> =>
  send("/auth/totp", { method: "POST", body: JSON.stringify({ code }) });

export const recover = (identifier: string, code: string): Promise<TotpDone> =>
  send("/auth/recover", { method: "POST", body: JSON.stringify({ identifier, code }) });

export const recoverByEmail = (identifier: string): Promise<{ status: string }> =>
  send("/auth/recover/email", { method: "POST", body: JSON.stringify({ identifier }) });

export const resetPassword = (
  companyId: string,
  token: string,
  newPassword: string,
): Promise<{ status: string }> =>
  send("/auth/recover/reset", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, token, new_password: newPassword }),
  });

export const logout = (): Promise<{ status: string }> => send("/auth/logout", { method: "POST" });

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
  phone?: string;
  phone_country?: string;
  socials?: Partial<Record<SocialNetwork, string>>;
  privacy?: Partial<Privacy>;
  current_password?: string;
  new_password?: string;
  totp_code?: string;
  email_code?: string;
}): Promise<{ company: Company }> => send("/me", { method: "PATCH", body: JSON.stringify(input) });

/** Consulta el TXT del dominio. Sin registro, la URL deja de estar vigente. */
export const verifyWebsite = (): Promise<{ verified: boolean; error?: string; company: Company }> =>
  send("/me/website/verify", { method: "POST" });

/** Manda el código de seis dígitos para un cambio de contraseña. */
export const requestPasswordEmail = (): Promise<{ sent: boolean; to: string; kind: CompanyEmailKind }> =>
  send("/me/password/email", { method: "POST" });

export const setEmail = (kind: CompanyEmailKind, email: string): Promise<{ emails: CompanyEmail[] }> =>
  send(`/emails/${kind}`, { method: "PUT", body: JSON.stringify({ email }) });

export const resendEmail = (kind: CompanyEmailKind): Promise<{ status: string }> =>
  send(`/emails/${kind}/resend`, { method: "POST" });

export const removeEmail = (kind: CompanyEmailKind): Promise<{ emails: CompanyEmail[] }> =>
  send(`/emails/${kind}`, { method: "DELETE" });

export const uploadMedia = (kind: "logo" | "banner", file: File): Promise<{ company: Company }> => {
  const form = new FormData();
  form.append("file", file);
  return send(`/media/${kind}`, { method: "POST", body: form });
};

export const removeMedia = (kind: "logo" | "banner"): Promise<{ company: Company }> =>
  send(`/media/${kind}`, { method: "DELETE" });

export const addMember = (handle: string): Promise<{ members: CompanyMember[] }> =>
  send("/members", { method: "POST", body: JSON.stringify({ handle }) });

export const removeMember = (userId: string): Promise<{ members: CompanyMember[] }> =>
  send(`/members/${userId}`, { method: "DELETE" });

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
