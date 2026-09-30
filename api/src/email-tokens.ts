import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Los enlaces de un solo uso que viajan por correo, y el registro de qué
 * correos están verificados.
 *
 * Una persona y una empresa son tablas distintas, así que todo va con un par
 * (tipo, id). El correo nunca se guarda acá: solo su hash, para saber si el
 * que está verificado sigue siendo el que la cuenta tiene hoy.
 */
export type SubjectKind = "user" | "company";
export type Purpose = "verify" | "reset";

const MINUTE = 60_000;

/** Verificar no apura; cambiar una contraseña sí. Un enlace de reset que dura
 * un día es un enlace que alguien más puede encontrar abierto. */
const LIFETIME: Record<Purpose, number> = {
  verify: 24 * 60 * MINUTE,
  reset: 30 * MINUTE,
};

/**
 * Un correo por cuenta y por motivo cada diez minutos. No es cortesía: el plan
 * gratis de Resend tiene un tope de 100 por día para todo el sitio, y sin esto
 * alguien pide un reset por minuto contra cuentas ajenas y deja a todo el
 * mundo sin correos de verificación hasta mañana.
 */
const COOLDOWN_MS = 10 * MINUTE;

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

export const emailHash = (email: string): string => sha256(email.trim().toLowerCase());

function prune(now: Date): void {
  db().run("DELETE FROM email_tokens WHERE expires_at <= ?", [now.toISOString()]);
}

/**
 * Un token nuevo, o `null` si esa cuenta ya recibió uno igual hace menos de
 * diez minutos. Quien llama no le cuenta a nadie cuál de las dos pasó: la
 * respuesta hacia afuera es la misma.
 */
export function issue(
  purpose: Purpose,
  kind: SubjectKind,
  id: string,
  email: string,
  now: Date = new Date(),
): string | null {
  prune(now);

  const recent = db()
    .query<{ n: number }, [string, string, string, string]>(
      `SELECT COUNT(*) AS n FROM email_tokens
        WHERE purpose = ? AND subject_kind = ? AND subject_id = ? AND created_at > ?`,
    )
    .get(purpose, kind, id, new Date(now.getTime() - COOLDOWN_MS).toISOString());
  if ((recent?.n ?? 0) > 0) return null;

  /** Pedir uno nuevo invalida los anteriores: solo vale el último enlace. */
  db().run("DELETE FROM email_tokens WHERE purpose = ? AND subject_kind = ? AND subject_id = ?", [
    purpose,
    kind,
    id,
  ]);

  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  db().run(
    `INSERT INTO email_tokens (token_hash, purpose, subject_kind, subject_id, email_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sha256(token),
      purpose,
      kind,
      id,
      emailHash(email),
      now.toISOString(),
      new Date(now.getTime() + LIFETIME[purpose]).toISOString(),
    ],
  );
  return token;
}

export interface Redeemed {
  kind: SubjectKind;
  id: string;
  emailHash: string;
}

/** Lo consume: un enlace sirve una vez, lo haya usado quien lo haya usado. */
export function redeem(purpose: Purpose, token: string, now: Date = new Date()): Result<Redeemed> {
  prune(now);

  const row = db()
    .query<{ subject_kind: SubjectKind; subject_id: string; email_hash: string }, [string, string]>(
      "SELECT subject_kind, subject_id, email_hash FROM email_tokens WHERE token_hash = ? AND purpose = ?",
    )
    .get(sha256(token), purpose);
  if (!row) return { ok: false, error: "ese enlace venció o ya se usó" };

  db().run("DELETE FROM email_tokens WHERE token_hash = ?", [sha256(token)]);
  return {
    ok: true,
    value: { kind: row.subject_kind, id: row.subject_id, emailHash: row.email_hash },
  };
}

export function markVerified(
  kind: SubjectKind,
  id: string,
  hash: string,
  now: Date = new Date(),
): void {
  db().run(
    `INSERT INTO email_verified (subject_kind, subject_id, email_hash, verified_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(subject_kind, subject_id) DO UPDATE SET email_hash = excluded.email_hash, verified_at = excluded.verified_at`,
    [kind, id, hash, now.toISOString()],
  );
}

/** Verificado quiere decir: el correo que tiene hoy es el que se confirmó. Si
 * lo cambió después, deja de estarlo solo, sin que nadie borre nada. */
export function isVerified(kind: SubjectKind, id: string, email: string | null): boolean {
  if (!email) return false;
  const row = db()
    .query<{ email_hash: string }, [string, string]>(
      "SELECT email_hash FROM email_verified WHERE subject_kind = ? AND subject_id = ?",
    )
    .get(kind, id);
  return row?.email_hash === emailHash(email);
}
