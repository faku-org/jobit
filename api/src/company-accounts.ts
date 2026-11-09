import * as companies from "./companies.ts";
import type { Company } from "./companies.ts";
import { decrypt, encrypt, encryptionEnabled } from "./crypto.ts";
import { db } from "./db.ts";
import { checkPassword } from "./password.ts";
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

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

export const hashPassword = (plain: string): Promise<string> => Bun.password.hash(plain);

const cleanPassword = (raw: string): Result<string> => checkPassword(raw);

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

/* --- Segundo paso obligatorio -------------------------------------------- */

interface AccountRow {
  company_id: string;
  totp_secret_enc: string | null;
  totp_enabled: number;
  deactivated_at: string;
}

function accountRow(companyId: string): AccountRow | null {
  return (
    db()
      .query<AccountRow, [string]>(
        "SELECT company_id, totp_secret_enc, totp_enabled, deactivated_at FROM company_accounts WHERE company_id = ?",
      )
      .get(companyId) ?? null
  );
}

export function totpEnabled(companyId: string): boolean {
  return accountRow(companyId)?.totp_enabled === 1;
}

/** El secreto queda guardado pero apagado hasta que el código lo confirme. */
export async function setTotpSecret(
  companyId: string,
  secret: string,
  now: Date = new Date(),
): Promise<Result<void>> {
  const encrypted = await encrypt(secret);
  if (!encrypted.ok) return encrypted;
  db().run(
    "UPDATE company_accounts SET totp_secret_enc = ?, totp_enabled = 0, updated_at = ? WHERE company_id = ?",
    [encrypted.value, now.toISOString(), companyId],
  );
  return { ok: true, value: undefined };
}

export async function totpSecret(companyId: string): Promise<string | null> {
  const row = accountRow(companyId);
  if (!row?.totp_secret_enc) return null;
  const plain = await decrypt(row.totp_secret_enc);
  return plain.ok ? plain.value : null;
}

export function enableTotp(companyId: string, now: Date = new Date()): void {
  db().run("UPDATE company_accounts SET totp_enabled = 1, updated_at = ? WHERE company_id = ?", [
    now.toISOString(),
    companyId,
  ]);
}

/** Desactivar el segundo paso es parte de la recuperación: se vuelve a pedir
 * en el próximo ingreso. */
export function disableTotp(companyId: string, now: Date = new Date()): void {
  db().run(
    "UPDATE company_accounts SET totp_secret_enc = NULL, totp_enabled = 0, updated_at = ? WHERE company_id = ?",
    [now.toISOString(), companyId],
  );
}

/**
 * Cambiar el segundo paso sin quedarse sin él: el secreto nuevo espera en
 * `totp_pending_enc` y el viejo sigue valiendo hasta que un código lo confirme.
 * Si nadie lo confirma, no pasa nada y el 2FA de siempre queda igual.
 */
export async function setPendingTotp(
  companyId: string,
  secret: string,
  now: Date = new Date(),
): Promise<Result<void>> {
  const encrypted = await encrypt(secret);
  if (!encrypted.ok) return encrypted;
  db().run(
    "UPDATE company_accounts SET totp_pending_enc = ?, updated_at = ? WHERE company_id = ?",
    [encrypted.value, now.toISOString(), companyId],
  );
  return { ok: true, value: undefined };
}

export async function pendingTotpSecret(companyId: string): Promise<string | null> {
  const row = db()
    .query<{ totp_pending_enc: string | null }, [string]>(
      "SELECT totp_pending_enc FROM company_accounts WHERE company_id = ?",
    )
    .get(companyId);
  if (!row?.totp_pending_enc) return null;
  const plain = await decrypt(row.totp_pending_enc);
  return plain.ok ? plain.value : null;
}

/** El secreto pendiente pasa a ser el activo y el nuevo código ya cuenta. */
export function promotePendingTotp(companyId: string, now: Date = new Date()): void {
  db().run(
    `UPDATE company_accounts
        SET totp_secret_enc = totp_pending_enc, totp_pending_enc = NULL, totp_enabled = 1, updated_at = ?
      WHERE company_id = ?`,
    [now.toISOString(), companyId],
  );
}

export function clearPendingTotp(companyId: string, now: Date = new Date()): void {
  db().run("UPDATE company_accounts SET totp_pending_enc = NULL, updated_at = ? WHERE company_id = ?", [
    now.toISOString(),
    companyId,
  ]);
}

/* --- Desactivar y recuperar la cuenta ------------------------------------ */

export function isDeactivated(companyId: string): boolean {
  return (accountRow(companyId)?.deactivated_at ?? "") !== "";
}

/** Desactivada: no entra nadie hasta que se recupere por el correo alterno. */
export function deactivate(companyId: string, now: Date = new Date()): void {
  db().run("UPDATE company_accounts SET deactivated_at = ?, updated_at = ? WHERE company_id = ?", [
    now.toISOString(),
    now.toISOString(),
    companyId,
  ]);
}

/** Recuperar el acceso con el enlace del correo la vuelve a encender. */
export function reactivate(companyId: string, now: Date = new Date()): void {
  db().run("UPDATE company_accounts SET deactivated_at = '', updated_at = ? WHERE company_id = ?", [
    now.toISOString(),
    companyId,
  ]);
}

/* --- Enlace de recuperación por correo ----------------------------------- */

const RESET_MINUTES = 30;

const hashToken = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const mintToken = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");

/** Emite un enlace nuevo; el anterior deja de valer. */
export function startReset(companyId: string, now: Date = new Date()): string {
  const token = mintToken();
  db().run(
    `INSERT INTO company_resets (company_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       token_hash = excluded.token_hash,
       expires_at = excluded.expires_at,
       created_at = excluded.created_at`,
    [
      companyId,
      hashToken(token),
      new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString(),
      now.toISOString(),
    ],
  );
  return token;
}

/** Consume el enlace: uno solo por emisión y con vencimiento. */
export function consumeReset(companyId: string, token: string, now: Date = new Date()): boolean {
  const row = db()
    .query<{ token_hash: string; expires_at: string }, [string]>(
      "SELECT token_hash, expires_at FROM company_resets WHERE company_id = ?",
    )
    .get(companyId);
  if (!row || !token) return false;
  if (row.token_hash !== hashToken(token)) return false;
  if (Date.parse(row.expires_at) < now.getTime()) return false;

  db().run("DELETE FROM company_resets WHERE company_id = ?", [companyId]);
  return true;
}

/* --- Código de cambio de contraseña -------------------------------------- */

const CODE_MINUTES = 15;

function mintSixDigits(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  /** `>>> 0` porque el desplazamiento de bits da un entero con signo y el
   * módulo de un negativo sale negativo. */
  const value =
    ((((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)) >>>
      0);
  return String(value % 1_000_000).padStart(6, "0");
}

/** Emite un código nuevo; el anterior deja de valer. */
export function startPasswordCode(companyId: string, now: Date = new Date()): string {
  const code = mintSixDigits();
  db().run(
    `INSERT INTO company_password_codes (company_id, code_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       created_at = excluded.created_at`,
    [
      companyId,
      hashToken(code),
      new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
      now.toISOString(),
    ],
  );
  return code;
}

export function consumePasswordCode(
  companyId: string,
  code: string,
  now: Date = new Date(),
): boolean {
  const candidate = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;

  const row = db()
    .query<{ code_hash: string; expires_at: string }, [string]>(
      "SELECT code_hash, expires_at FROM company_password_codes WHERE company_id = ?",
    )
    .get(companyId);
  if (!row) return false;
  if (row.code_hash !== hashToken(candidate)) return false;
  if (Date.parse(row.expires_at) < now.getTime()) return false;

  db().run("DELETE FROM company_password_codes WHERE company_id = ?", [companyId]);
  return true;
}

export const encryptionReady = (): Promise<boolean> => encryptionEnabled();

/* --- Códigos de respaldo -------------------------------------------------- */

const RECOVERY_COUNT = 8;
/** Sin 0/O/1/I/L: son códigos que alguien copia a mano. */
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const RECOVERY_LENGTH = 10;

function mintRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_LENGTH));
  let code = "";
  for (const byte of bytes) code += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  return code;
}

const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^0-9A-Z]/g, "");

/** Deja la lista anterior sin efecto: se pisan, nunca se acumulan. */
export function generateRecoveryCodes(companyId: string): string[] {
  db().run("DELETE FROM company_recovery_codes WHERE company_id = ?", [companyId]);

  const codes = Array.from({ length: RECOVERY_COUNT }, mintRecoveryCode);
  const insert = db().prepare(
    "INSERT INTO company_recovery_codes (company_id, code_hash, used_at) VALUES (?, ?, '')",
  );
  for (const code of codes) insert.run(companyId, sha256(normaliseCode(code)));
  return codes;
}

export function consumeRecoveryCode(
  companyId: string,
  code: string,
  now: Date = new Date(),
): boolean {
  const hash = sha256(normaliseCode(code));
  const row = db()
    .query<{ code_hash: string }, [string, string]>(
      "SELECT code_hash FROM company_recovery_codes WHERE company_id = ? AND code_hash = ? AND used_at = ''",
    )
    .get(companyId, hash);
  if (!row) return false;

  db().run(
    "UPDATE company_recovery_codes SET used_at = ? WHERE company_id = ? AND code_hash = ?",
    [now.toISOString(), companyId, hash],
  );
  return true;
}

export function recoveryCodesLeft(companyId: string): number {
  const row = db()
    .query<{ n: number }, [string]>(
      "SELECT COUNT(*) AS n FROM company_recovery_codes WHERE company_id = ? AND used_at = ''",
    )
    .get(companyId);
  return row?.n ?? 0;
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
  if (isDeactivated(row.company_id)) return null;

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

/** Cierra todo menos la sesión que pide el lockdown, que necesita seguir
 * abierta para mostrar los códigos de respaldo nuevos. */
export function destroyOtherSessions(companyId: string, keep: string | undefined): void {
  if (!keep) {
    destroyAllSessions(companyId);
    return;
  }
  db().run("DELETE FROM company_sessions WHERE company_id = ? AND token_hash != ?", [
    companyId,
    sha256(keep),
  ]);
}

export function destroyAllSessions(companyId: string): void {
  db().run("DELETE FROM company_sessions WHERE company_id = ?", [companyId]);
}
