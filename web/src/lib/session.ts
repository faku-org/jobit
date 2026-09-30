import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/browser";

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
  /** Que el correo que tiene hoy es uno que la persona confirmó que lee. */
  email_verified: boolean;
  /** Cuántas llaves de acceso tiene. Con una o más, entrar pide la llave. */
  passkeys: number;
  /** Solo en cuentas que lo activaron antes de las llaves: ya no se activa. */
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

export type LoginOutcome =
  | { status: "ok"; user: SessionUser }
  | { status: "passkey_required"; options: PublicKeyCredentialRequestOptionsJSON }
  | { status: "totp_required" };

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

export const logout = (): Promise<Outcome<unknown>> => send("/api/auth/logout", { method: "POST" });

export const patchMe = (input: {
  display_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}): Promise<Outcome<{ user: SessionUser }>> =>
  send<{ user: SessionUser }>("/api/me", { method: "PATCH", body: JSON.stringify(input) });

export const deleteMe = (password: string): Promise<Outcome<unknown>> =>
  send("/api/me", { method: "DELETE", body: JSON.stringify({ password }) });

/** Apagar el TOTP heredado. Activarlo ya no se puede: el segundo paso nuevo
 * es una llave de acceso. */
export const disableTotp = (password: string): Promise<Outcome<unknown>> =>
  send("/api/me/totp", { method: "DELETE", body: JSON.stringify({ password }) });

/* --- Llaves de acceso ---------------------------------------------------------
   El navegador arma la firma con la llave; acá solo se pasan las opciones que
   da el servidor y se devuelve la respuesta tal cual. */

export const submitPasskey = (
  response: AuthenticationResponseJSON,
): Promise<Outcome<{ user: SessionUser }>> =>
  send<{ user: SessionUser }>("/api/auth/passkey", {
    method: "POST",
    body: JSON.stringify({ response }),
  });

export interface Passkey {
  id: string;
  name: string;
  created_on: string;
}

export const listPasskeys = (): Promise<Outcome<{ passkeys: Passkey[] }>> =>
  send<{ passkeys: Passkey[] }>("/api/me/passkeys");

export const passkeyOptions = (): Promise<Outcome<PublicKeyCredentialCreationOptionsJSON>> =>
  send<PublicKeyCredentialCreationOptionsJSON>("/api/me/passkeys/options", {
    method: "POST",
    body: "{}",
  });

export const addPasskey = (
  response: RegistrationResponseJSON,
  name: string,
): Promise<Outcome<Passkey>> =>
  send<Passkey>("/api/me/passkeys", { method: "POST", body: JSON.stringify({ response, name }) });

export const removePasskey = (id: string, password: string): Promise<Outcome<unknown>> =>
  send(`/api/me/passkeys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });

/* --- Correo ------------------------------------------------------------------ */

export const resendVerification = (): Promise<Outcome<{ verified: boolean }>> =>
  send<{ verified: boolean }>("/api/me/email/verify", { method: "POST", body: "{}" });

/** Contesta lo mismo exista o no la cuenta: no sirve para saber quién está. */
export const requestReset = (handle: string): Promise<Outcome<{ message: string }>> =>
  send<{ message: string }>("/api/auth/recover/email", {
    method: "POST",
    body: JSON.stringify({ handle }),
  });

export const resetPassword = (
  token: string,
  password: string,
): Promise<Outcome<{ kind: "user" | "company" }>> =>
  send<{ kind: "user" | "company" }>("/api/auth/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });

/* --- Lo que llega por la URL desde un correo --------------------------------- */

export type MailLanding =
  | { kind: "verified" }
  | { kind: "expired" }
  | { kind: "reset"; token: string };

let landing: MailLanding | null | undefined;

/** Se lee una sola vez por carga de página: la primera lectura limpia la
 * dirección, así que una segunda (el doble montaje de StrictMode, o dos
 * componentes que preguntan) ya no encontraría nada. */
export function mailLanding(): MailLanding | null {
  if (landing === undefined) landing = readMailLanding();
  return landing;
}

/**
 * Lo que trae la dirección cuando se llega desde un enlace de correo, y la
 * dirección limpia después de leerlo: un token de reset no tiene que quedar en
 * el historial ni en la barra, donde lo ve cualquiera que mire la pantalla.
 */
export function readMailLanding(location: Location = window.location): MailLanding | null {
  const params = new URLSearchParams(location.search);
  const reset = params.get("restablecer");
  const mail = params.get("correo");

  let landing: MailLanding | null = null;
  if (reset) landing = { kind: "reset", token: reset };
  else if (mail === "verificado") landing = { kind: "verified" };
  else if (mail === "vencido") landing = { kind: "expired" };
  if (!landing) return null;

  params.delete("restablecer");
  params.delete("correo");
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`,
  );
  return landing;
}
