import { SESSION_COOKIE } from "./users.ts";

/**
 * Lo que comparten las rutas que van detrás de la sesión de un usuario: la
 * cookie y cómo se lee. La del panel es otra, con otro nombre, y no se cruzan.
 */
const SECURE_COOKIES = process.env.ADMIN_INSECURE_COOKIES !== "true";

/** Alcance /api, que es donde vive todo lo que la necesita. */
const COOKIE_PATH = "/api";

export interface CookieJar {
  [key: string]:
    | { value?: unknown; set: (options: Record<string, unknown>) => void; remove: () => void }
    | undefined;
}

/** Elysia entrega el valor de la cookie como unknown mientras no se le declare
 * un esquema; acá alcanza con quedarse solo con lo que sea texto. */
export const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const sessionToken = (cookie: CookieJar): string | undefined =>
  tokenOf(cookie[SESSION_COOKIE]?.value);

export function setSessionCookie(cookie: CookieJar, token: string, expiresAt: string): void {
  cookie[SESSION_COOKIE]?.set({
    value: token,
    httpOnly: true,
    secure: SECURE_COOKIES,
    /** lax y no strict: quien vuelve desde un enlace compartido tiene que
     * llegar con la sesión puesta. Lo que escribe va por POST con JSON, que
     * un formulario ajeno no puede armar. */
    sameSite: "lax",
    path: COOKIE_PATH,
    expires: new Date(expiresAt),
  });
}

export const clearSessionCookie = (cookie: CookieJar): void => cookie[SESSION_COOKIE]?.remove();
