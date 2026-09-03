import { db } from "./db.ts";

/**
 * Una sola persona administra esto, así que no hay tabla de usuarios: la
 * credencial es un hash argon2id que vive en el entorno y nunca en el repo ni
 * en la base.
 *
 * Se genera con:
 *   bun -e 'console.log(await Bun.password.hash(prompt("clave: ")))'
 *
 * Sin ADMIN_PASSWORD_HASH el panel queda apagado entero. Falla cerrado a
 * propósito: un despliegue al que se le olvidó la variable tiene que quedarse
 * sin admin, no con un admin abierto.
 */
export const adminEnabled = (): boolean => (process.env.ADMIN_PASSWORD_HASH ?? "").length > 0;

const SESSION_HOURS = 12;
const HOUR_MS = 3_600_000;

export const SESSION_COOKIE = "jobit_admin";

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

/**
 * Compara contra el hash del entorno. argon2id ya es lento y de tiempo
 * constante, que es justo lo que hace falta acá.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  if (!hash) return false;

  try {
    return await Bun.password.verify(password, hash);
  } catch {
    // Un hash mal escrito en el entorno no es una credencial válida.
    return false;
  }
}

export interface Session {
  token: string;
  expiresAt: string;
}

export function createSession(now: Date = new Date()): Session {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * HOUR_MS).toISOString();
  const stamp = now.toISOString();

  db().run(
    `INSERT INTO admin_sessions (token_hash, created_at, expires_at, last_seen)
     VALUES (?, ?, ?, ?)`,
    [sha256(token), stamp, expiresAt, stamp],
  );

  return { token, expiresAt };
}

/** Aprovecha cada visita para sacar las sesiones que ya vencieron. */
export function sessionValid(token: string | undefined, now: Date = new Date()): boolean {
  if (!token) return false;

  const stamp = now.toISOString();
  db().run("DELETE FROM admin_sessions WHERE expires_at <= ?", [stamp]);

  const row = db()
    .query<{ token_hash: string }, [string, string]>(
      "SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .get(sha256(token), stamp);

  if (!row) return false;

  db().run("UPDATE admin_sessions SET last_seen = ? WHERE token_hash = ?", [stamp, sha256(token)]);
  return true;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db().run("DELETE FROM admin_sessions WHERE token_hash = ?", [sha256(token)]);
}

/** Cierra todo lo abierto: sirve si se cambia la clave o se sospecha una fuga. */
export function destroyAllSessions(): void {
  db().run("DELETE FROM admin_sessions");
}
