import { sha256 } from "./auth.ts";
import { db } from "./db.ts";
import { decryptSecret, encryptSecret, secretsEnabled } from "./secrets.ts";
import { generateTotpSecret, otpauthUrl, totpValid } from "./totp.ts";
import type { Result } from "./types.ts";

/**
 * Las cuentas de quien publica. El admin sigue siendo otra cosa: no tiene
 * tabla, su credencial vive en el entorno y las dos sesiones no se cruzan.
 *
 * Todo lo que se guarda acá está en el esquema de db.ts y es lo mínimo para
 * que alguien pueda volver a entrar y editar lo suyo. Las fechas son el día y
 * no el momento, que es lo que ya hace el resto del sistema.
 */
export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

interface UserRow {
  id: string;
  handle: string;
  display_name: string;
  password_hash: string;
  email_enc: string;
  totp_secret_enc: string;
  totp_enabled: number;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

/** Lo que sale de acá hacia afuera: ni hashes ni nada cifrado. */
export interface User {
  id: string;
  handle: string;
  display_name: string;
  status: UserStatus;
  totp_enabled: boolean;
  /** Si hay correo o no, nunca cuál: alcanza para saber si hay recuperación. */
  has_email: boolean;
  created_at: string;
}

export interface UserInput {
  handle: string;
  display_name: string;
  password: string;
  email?: string;
}

const MAX_NAME = 60;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const MAX_EMAIL = 300;

/** Tres a veinticuatro, sin empezar ni terminar en guión. Entra en una URL. */
const HANDLE = /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/;

/** Nombres que confundirían a quien lee una ficha. */
const RESERVED = new Set(["admin", "jobit", "api", "me", "soporte", "ayuda", "root", "sistema"]);

const RECOVERY_CODES = 8;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_HALF = 5;

const day = (now: Date): string => now.toISOString().slice(0, 10);

const trim = (value: string | undefined, max: number): string => (value ?? "").trim().slice(0, max);

const publicUser = (row: UserRow): User => ({
  id: row.id,
  handle: row.handle,
  display_name: row.display_name,
  status: row.status,
  totp_enabled: row.totp_enabled === 1,
  has_email: row.email_enc.length > 0,
  created_at: row.created_at,
});

export function cleanHandle(value: string | undefined): Result<string> {
  /** Sin recortar: un handle largo se rechaza, porque recortarlo daría una
   * cuenta con un nombre que la persona no pidió. */
  const handle = (value ?? "").trim().toLowerCase();
  if (!HANDLE.test(handle)) {
    return {
      ok: false,
      error: "el usuario va en minúsculas, de 3 a 24, con letras, números, - o _",
    };
  }
  if (RESERVED.has(handle)) return { ok: false, error: "ese usuario está reservado" };
  return { ok: true, value: handle };
}

function cleanEmail(value: string | undefined): Result<string> {
  const raw = trim(value, MAX_EMAIL);
  if (!raw) return { ok: true, value: "" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, error: "el correo no parece válido" };
  }
  return { ok: true, value: raw.toLowerCase() };
}

function cleanPassword(value: string | undefined): Result<string> {
  const password = value ?? "";
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `la contraseña necesita al menos ${MIN_PASSWORD} caracteres` };
  }
  if (password.length > MAX_PASSWORD) {
    return { ok: false, error: "la contraseña es demasiado larga" };
  }
  return { ok: true, value: password };
}

const randomCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_HALF * 2));
  const chars = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length] ?? "x");
  return `${chars.slice(0, CODE_HALF).join("")}-${chars.slice(CODE_HALF).join("")}`;
};

/** El código viaja con y sin guión según quién lo copie; se compara igual. */
const codeKey = (code: string): string => sha256(code.trim().toLowerCase().replace(/[\s-]/g, ""));

function writeRecoveryCodes(userId: string): string[] {
  const codes = Array.from({ length: RECOVERY_CODES }, randomCode);

  db().run("DELETE FROM user_recovery_codes WHERE user_id = ?", [userId]);
  for (const code of codes) {
    db().run("INSERT INTO user_recovery_codes (user_id, code_hash) VALUES (?, ?)", [
      userId,
      codeKey(code),
    ]);
  }

  return codes;
}

export function byId(id: string): User | null {
  const row = rowById(id);
  return row ? publicUser(row) : null;
}

export function byHandle(handle: string): User | null {
  const row = rowByHandle(handle);
  return row ? publicUser(row) : null;
}

const rowById = (id: string): UserRow | null =>
  db().query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(id) ?? null;

const rowByHandle = (handle: string): UserRow | null =>
  db()
    .query<UserRow, [string]>("SELECT * FROM users WHERE handle = ?")
    .get(handle.trim().toLowerCase()) ?? null;

export interface Registration {
  user: User;
  /** Se muestran una sola vez: de acá en adelante solo queda el hash. */
  recovery_codes: string[];
}

export async function createUser(
  input: UserInput,
  now: Date = new Date(),
): Promise<Result<Registration>> {
  const handle = cleanHandle(input.handle);
  if (!handle.ok) return handle;

  const displayName = trim(input.display_name, MAX_NAME) || handle.value;
  const password = cleanPassword(input.password);
  if (!password.ok) return password;

  const email = cleanEmail(input.email);
  if (!email.ok) return email;

  /** Sin clave de cifrado no se guarda un correo en claro: se rechaza el alta
   * con correo y la cuenta sin correo sigue siendo posible. */
  if (email.value && !secretsEnabled()) {
    return { ok: false, error: "el correo no se puede guardar en este momento; probá sin correo" };
  }

  if (rowByHandle(handle.value)) return { ok: false, error: "ese usuario ya existe" };

  const stamp = day(now);
  const id = crypto.randomUUID();
  const emailEnc = email.value ? ((await encryptSecret(email.value)) ?? "") : "";

  db().run(
    `INSERT INTO users (id, handle, display_name, password_hash, email_enc, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      id,
      handle.value,
      displayName,
      await Bun.password.hash(password.value),
      emailEnc,
      stamp,
      stamp,
    ],
  );

  const row = rowById(id);
  if (!row) return { ok: false, error: "no se pudo crear la cuenta" };

  return { ok: true, value: { user: publicUser(row), recovery_codes: writeRecoveryCodes(id) } };
}

export interface Credentials {
  handle: string;
  password: string;
}

/**
 * Null tanto si el usuario no existe como si la clave no coincide, y la clave
 * se verifica igual contra un hash de descarte cuando no existe: contestar
 * antes para un usuario inexistente sería decir cuáles existen.
 */
const DUMMY_HASH = await Bun.password.hash("no existe esta cuenta");

export async function verifyCredentials(credentials: Credentials): Promise<User | null> {
  const row = rowByHandle(credentials.handle ?? "");
  const hash = row?.password_hash ?? DUMMY_HASH;

  let matches = false;
  try {
    matches = await Bun.password.verify(credentials.password ?? "", hash);
  } catch {
    matches = false;
  }

  if (!row || !matches || row.status !== "active") return null;
  return publicUser(row);
}

/** Lo mismo pero contra una cuenta ya identificada, para confirmar un cambio
 * que la persona hace estando adentro. */
export async function passwordMatches(id: string, password: string): Promise<boolean> {
  const row = rowById(id);
  if (!row) return false;

  try {
    return await Bun.password.verify(password ?? "", row.password_hash);
  } catch {
    return false;
  }
}

/** El paso que falta después de la clave, si la cuenta tiene 2FA prendido. */
export async function verifyTotp(userId: string, code: string, now?: Date): Promise<boolean> {
  const row = rowById(userId);
  if (!row || row.totp_enabled !== 1) return false;

  const secret = await decryptSecret(row.totp_secret_enc);
  if (!secret) return false;

  return totpValid(secret, code, now);
}

export const SESSION_COOKIE = "jobit_session";

const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

/** Lo que dura la sesión a medio abrir, entre la clave y los seis dígitos. */
const PENDING_MINUTES = 5;

/**
 * El vencimiento cae en el borde del día: la sesión dura treinta días y la
 * fila no deja escrito a qué hora entró nadie.
 */
const expiryFor = (now: Date): string =>
  `${day(new Date(now.getTime() + SESSION_DAYS * DAY_MS))}T00:00:00.000Z`;

export interface UserSession {
  token: string;
  expiresAt: string;
  pendingTotp: boolean;
}

export function createUserSession(
  userId: string,
  options: { pendingTotp?: boolean } = {},
  now: Date = new Date(),
): UserSession {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const pending = options.pendingTotp === true;
  /** La espera del segundo paso sí lleva hora, porque dura minutos y la fila
   * se pisa o se borra en cuanto se resuelve. */
  const expiresAt = pending
    ? new Date(now.getTime() + PENDING_MINUTES * 60_000).toISOString()
    : expiryFor(now);
  const stamp = day(now);

  db().run(
    `INSERT INTO user_sessions (token_hash, user_id, pending_totp, created_at, expires_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sha256(token), userId, pending ? 1 : 0, stamp, expiresAt, stamp],
  );

  return { token, expiresAt, pendingTotp: pending };
}

interface SessionRow {
  user_id: string;
  pending_totp: number;
  expires_at: string;
  last_seen: string;
}

function sessionRow(token: string | undefined, now: Date): SessionRow | null {
  if (!token) return null;

  const stamp = now.toISOString();
  db().run("DELETE FROM user_sessions WHERE expires_at <= ?", [stamp]);

  return (
    db()
      .query<SessionRow, [string, string]>(
        `SELECT user_id, pending_totp, expires_at, last_seen
           FROM user_sessions WHERE token_hash = ? AND expires_at > ?`,
      )
      .get(sha256(token), stamp) ?? null
  );
}

/**
 * Quién es, o null. La sesión se renueva una vez por día como mucho: alcanza
 * para que quien publica no tenga que loguearse seguido y evita dejar escrito
 * cada visita.
 */
export function sessionUser(token: string | undefined, now: Date = new Date()): User | null {
  const row = sessionRow(token, now);
  if (!row || row.pending_totp === 1) return null;

  const today = day(now);
  if (row.last_seen !== today && token) {
    db().run("UPDATE user_sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?", [
      today,
      expiryFor(now),
      sha256(token),
    ]);
  }

  const user = rowById(row.user_id);
  if (!user || user.status !== "active") return null;
  return publicUser(user);
}

/** La sesión a medio abrir: solo sirve para el segundo paso. */
export function pendingSessionUser(
  token: string | undefined,
  now: Date = new Date(),
): string | null {
  const row = sessionRow(token, now);
  return row && row.pending_totp === 1 ? row.user_id : null;
}

export function confirmSession(token: string, now: Date = new Date()): string {
  const expiresAt = expiryFor(now);
  db().run(
    "UPDATE user_sessions SET pending_totp = 0, expires_at = ?, last_seen = ? WHERE token_hash = ?",
    [expiresAt, day(now), sha256(token)],
  );
  return expiresAt;
}

export function destroyUserSession(token: string | undefined): void {
  if (!token) return;
  db().run("DELETE FROM user_sessions WHERE token_hash = ?", [sha256(token)]);
}

/** Cierra todo lo abierto de esa cuenta: es lo que hace el cambio de clave. */
export function destroyUserSessions(userId: string): void {
  db().run("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
}

export interface UserUpdate {
  display_name?: string;
  email?: string | null;
  password?: string;
}

export async function updateUser(
  id: string,
  input: UserUpdate,
  now: Date = new Date(),
): Promise<Result<User>> {
  const current = rowById(id);
  if (!current) return { ok: false, error: "esa cuenta no existe" };

  const displayName =
    input.display_name === undefined
      ? current.display_name
      : trim(input.display_name, MAX_NAME) || current.handle;

  let emailEnc = current.email_enc;
  if (input.email !== undefined) {
    const email = cleanEmail(input.email ?? "");
    if (!email.ok) return email;

    if (!email.value) {
      emailEnc = "";
    } else {
      if (!secretsEnabled()) {
        return { ok: false, error: "el correo no se puede guardar en este momento" };
      }
      emailEnc = (await encryptSecret(email.value)) ?? "";
    }
  }

  let passwordHash = current.password_hash;
  if (input.password !== undefined) {
    const password = cleanPassword(input.password);
    if (!password.ok) return password;
    passwordHash = await Bun.password.hash(password.value);
  }

  db().run(
    `UPDATE users SET display_name = ?, email_enc = ?, password_hash = ?, updated_at = ?
      WHERE id = ?`,
    [displayName, emailEnc, passwordHash, day(now), id],
  );

  const row = rowById(id);
  return row ? { ok: true, value: publicUser(row) } : { ok: false, error: "esa cuenta no existe" };
}

/**
 * Borra de verdad: la cuenta, sus sesiones y sus códigos. Lo que escribió
 * sobre terceros pierde el autor y sobrevive, pero eso es de la calificación
 * y se resuelve donde viven las reseñas.
 */
export function removeUser(id: string): boolean {
  return db().run("DELETE FROM users WHERE id = ?", [id]).changes > 0;
}

export interface TotpSetup {
  secret: string;
  otpauth_url: string;
}

/**
 * Primer paso de prender 2FA: guarda el secreto sin habilitarlo. Hasta que no
 * llegue un código válido, la cuenta sigue entrando con la clave sola.
 */
export async function startTotp(id: string, now: Date = new Date()): Promise<Result<TotpSetup>> {
  const row = rowById(id);
  if (!row) return { ok: false, error: "esa cuenta no existe" };
  if (row.totp_enabled === 1) return { ok: false, error: "la cuenta ya tiene 2FA prendido" };
  if (!secretsEnabled()) {
    return { ok: false, error: "el segundo factor no está disponible en este momento" };
  }

  const secret = generateTotpSecret();
  const sealed = await encryptSecret(secret);
  if (!sealed) return { ok: false, error: "el segundo factor no está disponible en este momento" };

  db().run("UPDATE users SET totp_secret_enc = ?, totp_enabled = 0, updated_at = ? WHERE id = ?", [
    sealed,
    day(now),
    id,
  ]);

  return { ok: true, value: { secret, otpauth_url: otpauthUrl(secret, row.handle) } };
}

/** Segundo paso: el código prueba que la app quedó bien configurada. */
export async function confirmTotp(
  id: string,
  code: string,
  now: Date = new Date(),
): Promise<Result<User>> {
  const row = rowById(id);
  if (!row) return { ok: false, error: "esa cuenta no existe" };

  const secret = await decryptSecret(row.totp_secret_enc);
  if (!secret) return { ok: false, error: "primero hay que generar el secreto" };
  if (!(await totpValid(secret, code, now))) return { ok: false, error: "ese código no coincide" };

  db().run("UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?", [day(now), id]);

  const updated = rowById(id);
  return updated
    ? { ok: true, value: publicUser(updated) }
    : { ok: false, error: "esa cuenta no existe" };
}

export function disableTotp(id: string, now: Date = new Date()): boolean {
  return (
    db().run(
      "UPDATE users SET totp_secret_enc = '', totp_enabled = 0, updated_at = ? WHERE id = ?",
      [day(now), id],
    ).changes > 0
  );
}

export interface RecoveryState {
  /** Cuántos quedan sin usar, para poder avisar antes de que se acaben. */
  remaining: number;
}

export function recoveryState(userId: string): RecoveryState {
  const row = db()
    .query<{ n: number }, [string]>(
      "SELECT COUNT(*) AS n FROM user_recovery_codes WHERE user_id = ? AND used_at = ''",
    )
    .get(userId);
  return { remaining: row?.n ?? 0 };
}

/**
 * Gasta un código de respaldo. Es de un solo uso: queda marcado con el día y
 * no vuelve a servir.
 */
export function consumeRecoveryCode(userId: string, code: string, now: Date = new Date()): boolean {
  return (
    db().run(
      "UPDATE user_recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at = ''",
      [day(now), userId, codeKey(code)],
    ).changes > 0
  );
}

/** Después de recuperar la cuenta, los códigos viejos no valen más. */
export const resetRecoveryCodes = (userId: string): string[] => writeRecoveryCodes(userId);

/**
 * Recuperar con un código de respaldo: cambia la clave, gasta el código,
 * apaga el 2FA (quien perdió el teléfono perdió las dos cosas) y cierra todas
 * las sesiones abiertas.
 */
export async function recoverWithCode(
  handle: string,
  code: string,
  password: string,
  now: Date = new Date(),
): Promise<Result<{ user: User; recovery_codes: string[] }>> {
  const row = rowByHandle(handle ?? "");
  if (!row || !consumeRecoveryCode(row.id, code ?? "", now)) {
    return { ok: false, error: "ese código no sirve" };
  }

  const updated = await updateUser(row.id, { password }, now);
  if (!updated.ok) return updated;

  disableTotp(row.id, now);
  destroyUserSessions(row.id);

  const fresh = rowById(row.id);
  return {
    ok: true,
    value: {
      user: fresh ? publicUser(fresh) : updated.value,
      recovery_codes: resetRecoveryCodes(row.id),
    },
  };
}
