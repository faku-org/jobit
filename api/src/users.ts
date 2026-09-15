import { db } from "./db.ts";
import { open, seal } from "./secrets.ts";
import { otpauthUrl, newSecret, verifyTotp } from "./totp.ts";
import type { Result } from "./types.ts";

/**
 * Las cuentas de quien publica. No comparten nada con el admin: aquél no tiene
 * tabla de usuarios y su credencial vive en el entorno, y las dos sesiones
 * usan cookies distintas con caminos distintos.
 *
 * Lo que se guarda es lo mínimo para que alguien pueda volver a entrar y
 * editar lo suyo. El email es opcional y solo sirve para recuperar la cuenta;
 * quien no lo deja se lleva códigos de respaldo y se queda sin reset, y eso
 * hay que decírselo en el alta con todas las letras, no en letra chica.
 */
export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserRow {
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

/** Lo que sale por la API: ni el hash, ni el correo cifrado, ni el secreto. */
export interface PublicUser {
  id: string;
  handle: string;
  display_name: string;
  /** Si tiene correo, no cuál: la recuperación por correo lo necesita saber,
   * la pantalla de perfil también, y nadie más. */
  has_email: boolean;
  totp_enabled: boolean;
  status: UserStatus;
  created_at: string;
}

const HANDLE = /^[a-z0-9](?:[a-z0-9_.-]{1,22}[a-z0-9])$/;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const MAX_NAME = 60;
const MAX_EMAIL = 200;

const RECOVERY_CODES = 8;
const RECOVERY_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
/** Renovar en cada petición sería una escritura por lectura. Se renueva cuando
 * ya pasó un día de la última vez, que para una sesión de treinta es lo mismo
 * y cuesta mil veces menos. */
const RENEW_AFTER_MS = DAY_MS;
/** El primer paso del login con 2FA no es una sesión: es un permiso de cinco
 * minutos para mandar un código y nada más. */
const TOTP_STAGE_MINUTES = 5;

export type SessionStage = "open" | "totp";

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const randomToken = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

/**
 * Un hash de verdad contra el que verificar cuando el handle no existe. Sin
 * esto, un login a un handle inexistente contesta al instante y uno a un
 * handle real tarda lo que tarda argon2: la diferencia dice quién está
 * registrado.
 */
const ABSENT_HASH = await Bun.password.hash("no hay nadie con ese handle");

export const publicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  handle: row.handle,
  display_name: row.display_name,
  has_email: row.email_enc.length > 0,
  totp_enabled: row.totp_enabled === 1,
  status: row.status,
  created_at: row.created_at,
});

export function byId(id: string): UserRow | null {
  return db().query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(id) ?? null;
}

export function byHandle(handle: string): UserRow | null {
  return (
    db()
      .query<UserRow, [string]>("SELECT * FROM users WHERE handle = ?")
      .get(handle.trim().toLowerCase()) ?? null
  );
}

function cleanHandle(value: string): Result<string> {
  const handle = value.trim().toLowerCase();
  if (!HANDLE.test(handle)) {
    return {
      ok: false,
      error: "el usuario va en minúsculas, de 3 a 24 caracteres, sin espacios",
    };
  }
  return { ok: true, value: handle };
}

function cleanPassword(value: string): Result<string> {
  if (value.length < MIN_PASSWORD) {
    return { ok: false, error: `la contraseña necesita al menos ${MIN_PASSWORD} caracteres` };
  }
  if (value.length > MAX_PASSWORD) {
    return { ok: false, error: "esa contraseña es demasiado larga" };
  }
  return { ok: true, value };
}

function cleanEmail(value: string | undefined): Result<string> {
  const raw = (value ?? "").trim().slice(0, MAX_EMAIL);
  if (!raw) return { ok: true, value: "" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, error: "ese correo no parece válido" };
  }
  return { ok: true, value: raw.toLowerCase() };
}

/** Sin I, L, O ni 0/1: se dictan por teléfono y se copian a mano. */
function recoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = [...bytes].map((byte) => RECOVERY_CHARS[byte % RECOVERY_CHARS.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

function issueRecoveryCodes(userId: string): string[] {
  db().run("DELETE FROM user_recovery_codes WHERE user_id = ?", [userId]);

  const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
  const insert = db().prepare(
    "INSERT OR IGNORE INTO user_recovery_codes (user_id, code_hash) VALUES (?, ?)",
  );
  for (const code of codes) insert.run(userId, sha256(code));
  return codes;
}

export interface RegisterInput {
  handle: string;
  display_name: string;
  password: string;
  email?: string;
}

export interface Registration {
  user: PublicUser;
  /** Se muestran una sola vez y no se pueden volver a ver. */
  recovery_codes: string[];
}

export async function register(
  input: RegisterInput,
  now: Date = new Date(),
): Promise<Result<Registration>> {
  const handle = cleanHandle(input.handle);
  if (!handle.ok) return handle;

  const password = cleanPassword(input.password);
  if (!password.ok) return password;

  const email = cleanEmail(input.email);
  if (!email.ok) return email;

  const name = input.display_name.trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "hace falta un nombre visible" };

  if (byHandle(handle.value)) return { ok: false, error: "ese usuario ya está tomado" };

  const stamp = now.toISOString();
  const row: UserRow = {
    id: crypto.randomUUID(),
    handle: handle.value,
    display_name: name,
    password_hash: await Bun.password.hash(password.value),
    email_enc: await seal(email.value),
    totp_secret_enc: "",
    totp_enabled: 0,
    status: "active",
    created_at: stamp,
    updated_at: stamp,
  };

  try {
    db().run(
      `INSERT INTO users (id, handle, display_name, password_hash, email_enc,
                          totp_secret_enc, totp_enabled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.handle,
        row.display_name,
        row.password_hash,
        row.email_enc,
        row.totp_secret_enc,
        row.totp_enabled,
        row.status,
        row.created_at,
        row.updated_at,
      ],
    );
  } catch {
    /** La única restricción que puede saltar acá es el handle único, y entre
     * el chequeo de arriba y este insert puede haberse metido otro. */
    return { ok: false, error: "ese usuario ya está tomado" };
  }

  return { ok: true, value: { user: publicUser(row), recovery_codes: issueRecoveryCodes(row.id) } };
}

/** El mismo mensaje para handle inexistente, contraseña mala y cuenta
 * suspendida: la respuesta no es un directorio de quién está registrado. */
export async function verifyLogin(handle: string, password: string): Promise<UserRow | null> {
  const user = byHandle(handle);
  if (!user) {
    await Bun.password.verify(password, ABSENT_HASH).catch(() => false);
    return null;
  }

  const good = await Bun.password.verify(password, user.password_hash).catch(() => false);
  if (!good || user.status !== "active") return null;
  return user;
}

export interface UserSession {
  token: string;
  expiresAt: string;
  stage: SessionStage;
}

export function startSession(
  userId: string,
  stage: SessionStage = "open",
  now: Date = new Date(),
): UserSession {
  const token = randomToken();
  const life = stage === "open" ? SESSION_DAYS * DAY_MS : TOTP_STAGE_MINUTES * 60_000;
  const expiresAt = new Date(now.getTime() + life).toISOString();
  const stamp = now.toISOString();

  db().run(
    `INSERT INTO user_sessions (token_hash, user_id, stage, created_at, expires_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sha256(token), userId, stage, stamp, expiresAt, stamp],
  );

  return { token, expiresAt, stage };
}

interface SessionRow {
  token_hash: string;
  user_id: string;
  stage: SessionStage;
  expires_at: string;
  last_seen: string;
}

/** Aprovecha cada visita para sacar lo que ya venció, igual que el panel. */
function sessionRow(token: string | undefined, now: Date): SessionRow | null {
  if (!token) return null;

  const stamp = now.toISOString();
  db().run("DELETE FROM user_sessions WHERE expires_at <= ?", [stamp]);

  return (
    db()
      .query<SessionRow, [string, string]>(
        `SELECT token_hash, user_id, stage, expires_at, last_seen
           FROM user_sessions WHERE token_hash = ? AND expires_at > ?`,
      )
      .get(sha256(token), stamp) ?? null
  );
}

/** Quién está de este lado, o null. Solo cuentan las sesiones abiertas: una
 * que quedó en el segundo paso todavía no es nadie. */
export function sessionUser(token: string | undefined, now: Date = new Date()): UserRow | null {
  const row = sessionRow(token, now);
  if (!row || row.stage !== "open") return null;

  const user = byId(row.user_id);
  if (!user || user.status !== "active") return null;

  if (now.getTime() - Date.parse(row.last_seen) >= RENEW_AFTER_MS) {
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS).toISOString();
    db().run("UPDATE user_sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?", [
      now.toISOString(),
      expiresAt,
      row.token_hash,
    ]);
  }

  return user;
}

/** El usuario de una sesión que está esperando el código, y nada más. */
export function pendingTotpUser(token: string | undefined, now: Date = new Date()): UserRow | null {
  const row = sessionRow(token, now);
  if (!row || row.stage !== "totp") return null;
  return byId(row.user_id);
}

/** Segundo paso superado: la misma fila pasa a valer treinta días. */
export function openSession(token: string, now: Date = new Date()): string {
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS).toISOString();
  db().run(
    "UPDATE user_sessions SET stage = 'open', expires_at = ?, last_seen = ? WHERE token_hash = ?",
    [expiresAt, now.toISOString(), sha256(token)],
  );
  return expiresAt;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db().run("DELETE FROM user_sessions WHERE token_hash = ?", [sha256(token)]);
}

/** Todo lo abierto de una cuenta: cambio de contraseña, 2FA, o el botón de
 * "cerrar todas" del perfil. */
export function destroyUserSessions(userId: string): void {
  db().run("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
}

export interface ProfileInput {
  display_name?: string;
  /** Cadena vacía saca el correo guardado. */
  email?: string;
}

export async function updateProfile(
  userId: string,
  input: ProfileInput,
  now: Date = new Date(),
): Promise<Result<PublicUser>> {
  const current = byId(userId);
  if (!current) return { ok: false, error: "esa cuenta no existe" };

  const name =
    input.display_name === undefined
      ? current.display_name
      : input.display_name.trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "hace falta un nombre visible" };

  let emailEnc = current.email_enc;
  if (input.email !== undefined) {
    const email = cleanEmail(input.email);
    if (!email.ok) return email;
    emailEnc = await seal(email.value);
  }

  const stamp = now.toISOString();
  db().run("UPDATE users SET display_name = ?, email_enc = ?, updated_at = ? WHERE id = ?", [
    name,
    emailEnc,
    stamp,
    userId,
  ]);

  return { ok: true, value: publicUser({ ...current, display_name: name, email_enc: emailEnc }) };
}

/** El correo en claro. Lo lee la persona dueña y nadie más. */
export const emailOf = (row: UserRow): Promise<string | null> => open(row.email_enc);

export async function changePassword(
  userId: string,
  current: string,
  next: string,
  now: Date = new Date(),
): Promise<Result<true>> {
  const user = byId(userId);
  if (!user) return { ok: false, error: "esa cuenta no existe" };

  const good = await Bun.password.verify(current, user.password_hash).catch(() => false);
  if (!good) return { ok: false, error: "la contraseña actual no coincide" };

  const password = cleanPassword(next);
  if (!password.ok) return password;

  db().run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
    await Bun.password.hash(password.value),
    now.toISOString(),
    userId,
  ]);

  /** Cambiar la contraseña cierra lo demás: si se cambia porque alguien más
   * entró, dejarle la sesión abierta no arregla nada. */
  destroyUserSessions(userId);
  return { ok: true, value: true };
}

export interface TotpSetup {
  secret: string;
  otpauth: string;
}

/** Guarda el secreto pero no prende el 2FA: recién se prende cuando la persona
 * escribe un código, que es la prueba de que lo guardó de verdad. */
export async function startTotp(
  userId: string,
  now: Date = new Date(),
): Promise<Result<TotpSetup>> {
  const user = byId(userId);
  if (!user) return { ok: false, error: "esa cuenta no existe" };
  if (user.totp_enabled === 1) return { ok: false, error: "el segundo factor ya está activo" };

  const secret = newSecret();
  db().run("UPDATE users SET totp_secret_enc = ?, updated_at = ? WHERE id = ?", [
    await seal(secret),
    now.toISOString(),
    userId,
  ]);

  return { ok: true, value: { secret, otpauth: otpauthUrl(user.handle, secret) } };
}

export async function confirmTotp(
  userId: string,
  code: string,
  now: Date = new Date(),
): Promise<Result<true>> {
  const user = byId(userId);
  if (!user) return { ok: false, error: "esa cuenta no existe" };

  const secret = await open(user.totp_secret_enc);
  if (!secret) return { ok: false, error: "no hay un segundo factor a medio configurar" };

  if (!(await verifyTotp(secret, code, now))) {
    return { ok: false, error: "ese código no coincide" };
  }

  db().run("UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?", [
    now.toISOString(),
    userId,
  ]);
  return { ok: true, value: true };
}

/** Apagarlo pide la contraseña: si alguien se sentó frente a una sesión
 * abierta, no puede sacarle el segundo factor a la cuenta. */
export async function disableTotp(
  userId: string,
  password: string,
  now: Date = new Date(),
): Promise<Result<true>> {
  const user = byId(userId);
  if (!user) return { ok: false, error: "esa cuenta no existe" };

  const good = await Bun.password.verify(password, user.password_hash).catch(() => false);
  if (!good) return { ok: false, error: "la contraseña no coincide" };

  db().run("UPDATE users SET totp_enabled = 0, totp_secret_enc = '', updated_at = ? WHERE id = ?", [
    now.toISOString(),
    userId,
  ]);
  return { ok: true, value: true };
}

export async function totpSecretOf(user: UserRow): Promise<string | null> {
  return user.totp_enabled === 1 ? open(user.totp_secret_enc) : null;
}

export function recoveryCodesLeft(userId: string): number {
  return (
    db()
      .query<{ n: number }, [string]>(
        "SELECT COUNT(*) AS n FROM user_recovery_codes WHERE user_id = ? AND used_at = ''",
      )
      .get(userId)?.n ?? 0
  );
}

/**
 * Un código de respaldo cambia la contraseña y cierra todo lo abierto. No abre
 * una sesión por sí solo: quien lo usa termina entrando con la contraseña
 * nueva, que es un paso más y un estado menos que mantener.
 */
export async function recoverWithCode(
  handle: string,
  code: string,
  newPassword: string,
  now: Date = new Date(),
): Promise<Result<true>> {
  const invalid: Result<true> = { ok: false, error: "ese código no sirve" };

  const user = byHandle(handle);
  if (!user) return invalid;

  const password = cleanPassword(newPassword);
  if (!password.ok) return password;

  const hash = sha256(code.trim().toUpperCase());
  const used = db().run(
    "UPDATE user_recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at = ''",
    [now.toISOString().slice(0, 10), user.id, hash],
  );
  if (used.changes === 0) return invalid;

  db().run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
    await Bun.password.hash(password.value),
    now.toISOString(),
    user.id,
  ]);
  destroyUserSessions(user.id);
  return { ok: true, value: true };
}

/** Vuelve a emitir los ocho y quema los que había. */
export const regenerateRecoveryCodes = (userId: string): string[] => issueRecoveryCodes(userId);

/**
 * Borra de verdad: la cuenta, sus sesiones, sus códigos y, por las claves
 * foráneas, sus servicios con todo lo que cuelga. Las reseñas que la persona
 * escribió pierden el autor y la nota sobrevive, porque es de un tercero y no
 * le pertenece; esa parte la implementa #31 cuando exista la tabla.
 */
export async function removeAccount(userId: string, password: string): Promise<Result<true>> {
  const user = byId(userId);
  if (!user) return { ok: false, error: "esa cuenta no existe" };

  const good = await Bun.password.verify(password, user.password_hash).catch(() => false);
  if (!good) return { ok: false, error: "la contraseña no coincide" };

  db().run("DELETE FROM users WHERE id = ?", [userId]);
  return { ok: true, value: true };
}
