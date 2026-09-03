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
