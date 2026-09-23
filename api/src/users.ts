import { decrypt, encrypt, encryptionEnabled } from "./crypto.ts";
import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Quien publica un servicio. Es lo mínimo para que alguien vuelva a entrar y
 * edite lo suyo: handle, nombre visible y contraseña. El email es opcional y
 * solo sirve para recuperar la cuenta; el secreto TOTP también es opcional.
 *
 * Nada de IP, user agent, historial de inicios ni "último acceso desde". Lo que
 * no está acá es justamente lo que la Zero Data Policy promete que no está.
 */
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
/** Una sesión que se usa todos los días se renueva sola; una que no, vence. */
const RENEW_AFTER_MS = DAY_MS;

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  handle: string;
  display_name: string;
  /** Nunca sale en una respuesta: solo lo lee verifyPassword. */
  password_hash: string;
  email_enc: string | null;
  totp_secret_enc: string | null;
  totp_enabled: boolean;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

interface UserRow extends Omit<User, "totp_enabled"> {
  totp_enabled: number;
}

const hydrate = (row: UserRow): User => ({ ...row, totp_enabled: row.totp_enabled === 1 });

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const MIN_HANDLE = 3;
const MAX_HANDLE = 30;
const MAX_DISPLAY_NAME = 80;
const MAX_PASSWORD = 200;
const MIN_PASSWORD = 8;

/** Nombres que confundirían a quien ve una URL o pide soporte. */
const RESERVED = new Set(["admin", "jobit", "soporte", "sistema", "root", "api", "www"]);

export function normaliseHandle(raw: string): Result<string> {
  const handle = raw.trim().toLowerCase();
  if (handle.length < MIN_HANDLE || handle.length > MAX_HANDLE) {
    return { ok: false, error: `el handle tiene que tener entre ${MIN_HANDLE} y ${MAX_HANDLE} letras` };
  }
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(handle)) {
    return { ok: false, error: "el handle va con letras, números, punto, guión o guión bajo" };
  }
  if (RESERVED.has(handle)) return { ok: false, error: "ese handle está reservado" };
  return { ok: true, value: handle };
}

const cleanEmail = (raw: string): Result<string> => {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "el correo no parece válido" };
  }
  return { ok: true, value: email };
};

/** Se colapsan los espacios y se recorta: es lo que se ve en la ficha. */
const cleanDisplayName = (raw: string): Result<string> => {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "hace falta un nombre visible" };
  return { ok: true, value: name.slice(0, MAX_DISPLAY_NAME) };
};

const cleanPassword = (raw: string): Result<string> => {
  if (raw.length < MIN_PASSWORD) {
    return { ok: false, error: `la contraseña necesita al menos ${MIN_PASSWORD} caracteres` };
  }
  if (raw.length > MAX_PASSWORD) return { ok: false, error: "esa contraseña es demasiado larga" };
  return { ok: true, value: raw };
};

export const hashPassword = (plain: string): Promise<string> => Bun.password.hash(plain);

export const verifyPassword = async (user: User, plain: string): Promise<boolean> => {
  try {
    return await Bun.password.verify(plain, user.password_hash ?? "");
  } catch {
    return false;
  }
};

const ROW_COLUMNS =
  "id, handle, display_name, password_hash, email_enc, totp_secret_enc, totp_enabled, status, created_at, updated_at";

export function byId(id: string): User | null {
  const row = db()
    .query<UserRow, [string]>(`SELECT ${ROW_COLUMNS} FROM users WHERE id = ?`)
    .get(id);
  return row ? hydrate(row) : null;
}

export function byHandle(handle: string): User | null {
  const normalised = handle.trim().toLowerCase();
  const row = db()
    .query<UserRow, [string]>(`SELECT ${ROW_COLUMNS} FROM users WHERE handle = ?`)
    .get(normalised);
  return row ? hydrate(row) : null;
}

export interface RegisterInput {
  handle: string;
  display_name: string;
  password: string;
  email?: string;
}

export interface Registered {
  user: User;
  /** En claro y por única vez: en la base solo queda su sha256. */
  recoveryCodes: string[];
}

export async function create(
  input: RegisterInput,
  now: Date = new Date(),
): Promise<Result<Registered>> {
  const handle = normaliseHandle(input.handle);
  if (!handle.ok) return handle;
  if (byHandle(handle.value)) return { ok: false, error: "ese handle ya está tomado" };

  const displayName = cleanDisplayName(input.display_name);
  if (!displayName.ok) return displayName;

  const password = cleanPassword(input.password);
  if (!password.ok) return password;

  let emailEnc: string | null = null;
  const rawEmail = (input.email ?? "").trim();
  if (rawEmail) {
    const email = cleanEmail(rawEmail);
    if (!email.ok) return email;
    if (!(await encryptionEnabled())) {
      return { ok: false, error: "la recuperación por correo no está disponible en este servidor" };
    }
    const encrypted = await encrypt(email.value);
    if (!encrypted.ok) return encrypted;
    emailEnc = encrypted.value;
  }

  const stamp = now.toISOString();
  const id = crypto.randomUUID();

  db().run(
    `INSERT INTO users (${ROW_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      handle.value,
      displayName.value,
      await hashPassword(password.value),
      emailEnc,
      null,
      "active",
      stamp,
      stamp,
    ],
  );

  const user = byId(id);
  if (!user) return { ok: false, error: "no se pudo crear la cuenta" };
  return { ok: true, value: { user, recoveryCodes: generateRecoveryCodes(id) } };
}

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

/** Deja la lista anterior sin efecto: se pisan, nunca se acumulan. */
export function generateRecoveryCodes(userId: string): string[] {
  db().run("DELETE FROM user_recovery_codes WHERE user_id = ?", [userId]);

  const codes = Array.from({ length: RECOVERY_COUNT }, mintRecoveryCode);
  const insert = db().prepare(
    "INSERT INTO user_recovery_codes (user_id, code_hash, used_at) VALUES (?, ?, '')",
  );
  for (const code of codes) insert.run(userId, sha256(normaliseCode(code)));
  return codes;
}

const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function consumeRecoveryCode(userId: string, code: string, now: Date = new Date()): boolean {
  const hash = sha256(normaliseCode(code));
  const row = db()
    .query<{ code_hash: string }, [string, string]>(
      "SELECT code_hash FROM user_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at = ''",
    )
    .get(userId, hash);
  if (!row) return false;

  db().run("UPDATE user_recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ?", [
    now.toISOString(),
    userId,
    hash,
  ]);
  return true;
}

export function recoveryCodesLeft(userId: string): number {
  const row = db()
    .query<{ n: number }, [string]>(
      "SELECT COUNT(*) AS n FROM user_recovery_codes WHERE user_id = ? AND used_at = ''",
    )
    .get(userId);
  return row?.n ?? 0;
}

export async function setEmail(userId: string, raw: string, now: Date = new Date()): Promise<Result<User>> {
  const email = raw.trim();
  let emailEnc: string | null = null;

  if (email) {
    const cleaned = cleanEmail(email);
    if (!cleaned.ok) return cleaned;
    if (!(await encryptionEnabled())) {
      return { ok: false, error: "la recuperación por correo no está disponible en este servidor" };
    }
    const encrypted = await encrypt(cleaned.value);
    if (!encrypted.ok) return encrypted;
    emailEnc = encrypted.value;
  }

  db().run("UPDATE users SET email_enc = ?, updated_at = ? WHERE id = ?", [
    emailEnc,
    now.toISOString(),
    userId,
  ]);
  const user = byId(userId);
  return user ? { ok: true, value: user } : { ok: false, error: "esa cuenta no existe" };
}

/** El email en claro, solo para quien lo necesite de verdad (mandar el correo). */
export async function emailOf(user: User): Promise<string | null> {
  if (!user.email_enc) return null;
  const plain = await decrypt(user.email_enc);
  return plain.ok ? plain.value : null;
}

export function setDisplayName(userId: string, raw: string, now: Date = new Date()): Result<User> {
  const name = cleanDisplayName(raw);
  if (!name.ok) return name;

  db().run("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?", [
    name.value,
    now.toISOString(),
    userId,
  ]);
  const user = byId(userId);
  return user ? { ok: true, value: user } : { ok: false, error: "esa cuenta no existe" };
}

export function setPasswordHash(userId: string, hash: string, now: Date = new Date()): void {
  db().run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
    hash,
    now.toISOString(),
    userId,
  ]);
}

/* --- Segunda vuelta ------------------------------------------------------- */

export async function setTotpSecret(
  userId: string,
  secret: string,
  now: Date = new Date(),
): Promise<Result<void>> {
  const encrypted = await encrypt(secret);
  if (!encrypted.ok) return encrypted;
  db().run(
    "UPDATE users SET totp_secret_enc = ?, totp_enabled = 0, updated_at = ? WHERE id = ?",
    [encrypted.value, now.toISOString(), userId],
  );
  return { ok: true, value: undefined };
}

export async function totpSecret(user: User): Promise<string | null> {
  if (!user.totp_secret_enc) return null;
  const plain = await decrypt(user.totp_secret_enc);
  return plain.ok ? plain.value : null;
}

export function enableTotp(userId: string, now: Date = new Date()): void {
  db().run("UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?", [
    now.toISOString(),
    userId,
  ]);
}

export function disableTotp(userId: string, now: Date = new Date()): void {
  db().run(
    "UPDATE users SET totp_secret_enc = NULL, totp_enabled = 0, updated_at = ? WHERE id = ?",
    [now.toISOString(), userId],
  );
}

/* --- Sesión --------------------------------------------------------------- */

export interface UserSession {
  token: string;
  expiresAt: string;
}

const sessionExpiry = (now: Date): { expiresAt: string; stamp: string } => ({
  expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS).toISOString(),
  stamp: now.toISOString(),
});

export function createSession(userId: string, now: Date = new Date()): UserSession {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const { expiresAt, stamp } = sessionExpiry(now);

  db().run(
    `INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, last_seen)
     VALUES (?, ?, ?, ?, ?)`,
    [sha256(token), userId, stamp, expiresAt, stamp],
  );
  return { token, expiresAt };
}

/**
 * Aprovecha cada visita para sacar lo vencido y, si la sesión viene usándose,
 * correrle el vencimiento para adelante. Devuelve null para una sesión que no
 * vale, para una cuenta suspendida y para una que ya no existe.
 */
export function sessionUser(token: string | undefined, now: Date = new Date()): User | null {
  if (!token) return null;
  const stamp = now.toISOString();
  db().run("DELETE FROM user_sessions WHERE expires_at <= ?", [stamp]);

  const row = db()
    .query<UserRow & { last_seen: string }, [string, string]>(
      `SELECT ${ROW_COLUMNS
        .split(", ")
        .map((column) => `u.${column}`)
        .join(", ")}, s.last_seen
         FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), stamp);

  if (!row || row.status !== "active") return null;

  const lastSeen = Date.parse(row.last_seen);
  if (!Number.isNaN(lastSeen) && now.getTime() - lastSeen >= RENEW_AFTER_MS) {
    const { expiresAt } = sessionExpiry(now);
    db().run("UPDATE user_sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?", [
      stamp,
      expiresAt,
      sha256(token),
    ]);
  }

  const { last_seen: _lastSeen, ...user } = row;
  return hydrate(user);
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db().run("DELETE FROM user_sessions WHERE token_hash = ?", [sha256(token)]);
}

export function destroyAllSessions(userId: string): void {
  db().run("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
}

/** Borrado real. Las dependencias (sesiones, códigos y, cuando existan, los
 * servicios) se van con la fila por las claves foráneas en cascada. */
export function remove(userId: string): boolean {
  return db().run("DELETE FROM users WHERE id = ?", [userId]).changes > 0;
}

export interface PublicUser {
  id: string;
  handle: string;
  display_name: string;
  has_email: boolean;
  totp_enabled: boolean;
  recovery_codes_left: number;
  created_at: string;
}

export const publicUser = (user: User): PublicUser => ({
  id: user.id,
  handle: user.handle,
  display_name: user.display_name,
  has_email: user.email_enc !== null,
  totp_enabled: user.totp_enabled,
  recovery_codes_left: recoveryCodesLeft(user.id),
  created_at: user.created_at,
});
