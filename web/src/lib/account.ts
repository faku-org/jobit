import type { Currency, Service, ServiceHour } from "./services.ts";

/**
 * La cuenta de quien publica, que no es la del panel: otra cookie, otra
 * sesión y otro alta. Existe por una sola razón, poder volver a editar lo que
 * publicaste, así que pide lo mínimo: un nombre de usuario, un nombre para
 * mostrar y una contraseña. El correo es opcional y sirve para recuperar.
 */
export interface Account {
  id: string;
  handle: string;
  display_name: string;
  status: string;
  totp_enabled: boolean;
  /** Si hay correo o no, nunca cuál. */
  has_email: boolean;
  created_at: string;
}

/** Cuántos códigos de respaldo quedan sin usar. */
export interface RecoveryState {
  remaining: number;
}

/** La sesión vencida no es un error a mostrar: es volver a entrar. */
export class NoSession extends Error {}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (response.status === 401) throw new NoSession("no hay sesión");

  if (!response.ok) {
    /** La API contesta `{error}` cuando el que se queja es el modelo, y el
     * resumen de Elysia cuando lo que no cuadra es la forma del cuerpo. Los
     * dos dicen algo; "la API respondió 422" no dice nada. */
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      summary?: string;
    } | null;
    throw new Error(body?.error ?? body?.summary ?? `La API respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface Registration {
  user: Account;
  /** Se muestran una sola vez: después solo queda el hash. */
  recovery_codes: string[];
}

export interface RegisterInput {
  handle: string;
  display_name: string;
  password: string;
  email?: string;
}

export const register = (input: RegisterInput): Promise<Registration> =>
  send("/api/auth/register", { method: "POST", body: JSON.stringify(input) });

/** El login puede terminar en la sesión abierta o en el segundo paso. */
export type LoginResult = { status: "ok"; user: Account } | { status: "totp_required" };

export const login = (handle: string, password: string): Promise<LoginResult> =>
  send("/api/auth/login", { method: "POST", body: JSON.stringify({ handle, password }) });

export const submitTotp = (code: string): Promise<{ status: "ok"; user: Account }> =>
  send("/api/auth/totp", { method: "POST", body: JSON.stringify({ code }) });

/** Entra con un código de respaldo. La API no cambia la contraseña acá: quien
 * quiera cambiarla lo hace desde la pestaña Cuenta. */
export const recover = (
  handle: string,
  code: string,
): Promise<{ status: "ok"; user: Account }> =>
  send("/api/auth/recover", { method: "POST", body: JSON.stringify({ handle, code }) });

export const logout = (): Promise<{ status: string }> =>
  send("/api/auth/logout", { method: "POST" });

export const fetchMe = (): Promise<{ user: Account }> => send("/api/me");

/**
 * Un precio como lo manda el formulario. La unidad y el tipo son opcionales
 * de verdad: la API los valida contra una lista cerrada, así que un campo sin
 * elegir se omite en vez de viajar vacío, que ahí sí sería un valor inválido.
 */
export interface ServicePriceInput {
  kind?: "base" | "extra";
  label?: string;
  amount: number;
  currency: Currency;
  unit?: string;
  notes?: string;
}

export interface ServiceInput {
  title: string;
  summary?: string;
  description?: string;
  category?: string;
  department?: string;
  city?: string;
  remote?: string;
  fixed_price?: boolean;
  work_style?: string;
  experience_years?: number | null;
  availability_note?: string;
  response_time?: string;
  /** draft o pending: publicar lo decide la moderación, no quien publica. */
  status?: "draft" | "pending";
  skills?: string[];
  prices?: ServicePriceInput[];
  hours?: ServiceHour[];
}

export interface MyServices {
  services: Service[];
  /** El tope por cuenta, para poder decirlo antes de que falle. */
  max: number;
}

export const fetchMyServices = (): Promise<MyServices> => send("/api/services/mine");

export const createService = (input: ServiceInput): Promise<Service> =>
  send("/api/services", { method: "POST", body: JSON.stringify(input) });

export const updateService = (id: string, input: ServiceInput): Promise<Service> =>
  send(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteService = (id: string): Promise<{ status: string }> =>
  send(`/api/services/${id}`, { method: "DELETE" });
