/**
 * El cliente de las cuentas. Habla con /api/auth y /api/me.
 *
 * La sesión viaja en una cookie HttpOnly que el navegador manda sola: acá no se
 * guarda ningún token, y por eso no hay nada que borrar del localStorage cuando
 * alguien cierra sesión.
 */
export interface SessionUser {
  id: string;
  handle: string;
  display_name: string;
  has_email: boolean;
  totp_enabled: boolean;
  recovery_codes_left: number;
  created_at: string;
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

/** Sin sesión no es un error: es alguien que todavía no entró. */
export async function currentUser(): Promise<SessionUser | null> {
  const response = await fetch("/api/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  const body = (await response.json()) as { user: SessionUser };
  return body.user;
}

export interface RegisterInput {
  handle: string;
  display_name: string;
  password: string;
  email: string;
}

export interface Registered {
  recovery_codes: string[];
  user: SessionUser;
}

export const register = (input: RegisterInput): Promise<Outcome<Registered>> =>
  send<Registered>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });

export type LoginOutcome = { status: "ok"; user: SessionUser } | { status: "totp_required" };

export const login = (handle: string, password: string): Promise<Outcome<LoginOutcome>> =>
  send<LoginOutcome>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ handle, password }),
  });

export const submitTotp = (code: string): Promise<Outcome<{ user: SessionUser }>> =>
  send<{ user: SessionUser }>("/api/auth/totp", { method: "POST", body: JSON.stringify({ code }) });

export const recover = (handle: string, code: string): Promise<Outcome<{ user: SessionUser }>> =>
  send<{ user: SessionUser }>("/api/auth/recover", {
    method: "POST",
    body: JSON.stringify({ handle, code }),
  });

export const logout = (): Promise<Outcome<unknown>> =>
  send("/api/auth/logout", { method: "POST" });

export const patchMe = (input: {
  display_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}): Promise<Outcome<{ user: SessionUser }>> =>
  send<{ user: SessionUser }>("/api/me", { method: "PATCH", body: JSON.stringify(input) });

export const deleteMe = (password: string): Promise<Outcome<unknown>> =>
  send("/api/me", { method: "DELETE", body: JSON.stringify({ password }) });

export interface TotpSetup {
  secret: string;
  otpauth: string;
}

export const startTotp = (): Promise<Outcome<TotpSetup>> =>
  send<TotpSetup>("/api/me/totp", { method: "POST", body: "{}" });

export const confirmTotp = (code: string): Promise<Outcome<{ totp_enabled: boolean }>> =>
  send<{ totp_enabled: boolean }>("/api/me/totp", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const disableTotp = (password: string): Promise<Outcome<unknown>> =>
  send("/api/me/totp", { method: "DELETE", body: JSON.stringify({ password }) });
