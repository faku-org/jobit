import * as companies from "./companies.ts";
import type { Company } from "./companies.ts";
import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * La cuenta de una empresa, separada de las del panel y de las de servicios.
 *
 * Comparte el mecanismo con `users.ts` —argon2id, sesión de 30 días que se
 * renueva sola, solo el sha256 del token en la base— pero no el alcance: es
 * otra cookie, otra tabla y otra empresa. Una sesión de acá no abre nada más
 * que `/api/empresas`.
 *
 * La empresa la crea el admin o se autoregistra; en los dos casos queda
 * `pending` y el admin la aprueba. Recién aprobada puede publicar.
 */
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
/** Una sesión que se usa todos los días se renueva sola; una que no, vence. */
const RENEW_AFTER_MS = DAY_MS;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

export const hashPassword = (plain: string): Promise<string> => Bun.password.hash(plain);

function cleanPassword(raw: string): Result<string> {
  if (raw.length < MIN_PASSWORD) {
    return { ok: false, error: `la contraseña necesita al menos ${MIN_PASSWORD} caracteres` };
  }
  if (raw.length > MAX_PASSWORD) return { ok: false, error: "esa contraseña es demasiado larga" };
  return { ok: true, value: raw };
}

export function hasAccount(companyId: string): boolean {
  const row = db()
    .query<{ company_id: string }, [string]>(
      "SELECT company_id FROM company_accounts WHERE company_id = ?",
    )
    .get(companyId);
  return row !== null;
}

export async function register(
  companyId: string,
  password: string,
  now: Date = new Date(),
): Promise<Result<void>> {
  const clean = cleanPassword(password);
  if (!clean.ok) return clean;
  if (hasAccount(companyId)) return { ok: false, error: "esa empresa ya tiene una cuenta" };

  const stamp = now.toISOString();
  db().run(
    `INSERT INTO company_accounts (company_id, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [companyId, await hashPassword(clean.value), stamp, stamp],
  );
  return { ok: true, value: undefined };
}

export async function verifyPassword(companyId: string, plain: string): Promise<boolean> {
  const row = db()
    .query<{ password_hash: string }, [string]>(
      "SELECT password_hash FROM company_accounts WHERE company_id = ?",
    )
    .get(companyId);
  if (!row) return false;

  try {
    return await Bun.password.verify(plain, row.password_hash);
  } catch {
    return false;
  }
}

export async function setPassword(
  companyId: string,
  password: string,
  now: Date = new Date(),
): Promise<Result<void>> {
  const clean = cleanPassword(password);
  if (!clean.ok) return clean;

  db().run("UPDATE company_accounts SET password_hash = ?, updated_at = ? WHERE company_id = ?", [
    await hashPassword(clean.value),
    now.toISOString(),
    companyId,
  ]);
  return { ok: true, value: undefined };
}

/* --- Sesión --------------------------------------------------------------- */

export interface CompanySession {
  token: string;
  expiresAt: string;
}

const sessionExpiry = (now: Date): { expiresAt: string; stamp: string } => ({
  expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS).toISOString(),
  stamp: now.toISOString(),
});

export function createSession(companyId: string, now: Date = new Date()): CompanySession {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const { expiresAt, stamp } = sessionExpiry(now);

  db().run(
    `INSERT INTO company_sessions (token_hash, company_id, created_at, expires_at, last_seen)
     VALUES (?, ?, ?, ?, ?)`,
    [sha256(token), companyId, stamp, expiresAt, stamp],
  );
  return { token, expiresAt };
}

/**
 * La empresa dueña de la sesión, o null. Suspender una empresa invalida su
 * sesión al instante sin borrar la fila: la próxima visita ya no entra.
 */
export function sessionCompany(token: string | undefined, now: Date = new Date()): Company | null {
  if (!token) return null;
  const stamp = now.toISOString();
  db().run("DELETE FROM company_sessions WHERE expires_at <= ?", [stamp]);

  const row = db()
    .query<{ company_id: string; last_seen: string }, [string, string]>(
      `SELECT company_id, last_seen FROM company_sessions
        WHERE token_hash = ? AND expires_at > ?`,
    )
    .get(sha256(token), stamp);
  if (!row) return null;

  const company = companies.byId(row.company_id);
  if (!company || company.status === "suspended") return null;

  const lastSeen = Date.parse(row.last_seen);
  if (!Number.isNaN(lastSeen) && now.getTime() - lastSeen >= RENEW_AFTER_MS) {
    const { expiresAt } = sessionExpiry(now);
    db().run("UPDATE company_sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?", [
      stamp,
      expiresAt,
      sha256(token),
    ]);
  }

  return company;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db().run("DELETE FROM company_sessions WHERE token_hash = ?", [sha256(token)]);
}

export function destroyAllSessions(companyId: string): void {
  db().run("DELETE FROM company_sessions WHERE company_id = ?", [companyId]);
}
