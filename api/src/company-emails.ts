import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Los correos de la empresa: facturación, contacto y soporte.
 *
 * Cada uno tiene lo suyo y se verifica aparte. La verificación es un token de
 * un solo uso que se manda al correo: hasta que no se confirma, la dirección se
 * guarda pero queda marcada como sin verificar, y el panel lo dice.
 */
export const COMPANY_EMAIL_KINDS = ["billing", "contact", "support", "recovery"] as const;
export type CompanyEmailKind = (typeof COMPANY_EMAIL_KINDS)[number];

export const KIND_LABEL: Record<CompanyEmailKind, string> = {
  billing: "Facturación",
  contact: "Contacto",
  support: "Soporte",
  recovery: "Recuperación",
};

export interface CompanyEmail {
  company_id: string;
  kind: CompanyEmailKind;
  email: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailRow extends Omit<CompanyEmail, "verified"> {
  verified: number;
}

const hydrate = (row: EmailRow): CompanyEmail => ({ ...row, verified: row.verified === 1 });

export const isKind = (value: unknown): value is CompanyEmailKind =>
  (COMPANY_EMAIL_KINDS as readonly unknown[]).includes(value);

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const TOKEN_HOURS = 24;

function mintToken(): { token: string; hash: string; expires: string } {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  return {
    token,
    hash: sha256(token),
    expires: new Date(Date.now() + TOKEN_HOURS * 3_600_000).toISOString(),
  };
}

export function list(companyId: string): CompanyEmail[] {
  return db()
    .query<EmailRow, [string]>(
      "SELECT * FROM company_emails WHERE company_id = ? ORDER BY kind",
    )
    .all(companyId)
    .map(hydrate);
}

export function get(companyId: string, kind: CompanyEmailKind): CompanyEmail | null {
  const row = db()
    .query<EmailRow, [string, string]>(
      "SELECT * FROM company_emails WHERE company_id = ? AND kind = ?",
    )
    .get(companyId, kind);
  return row ? hydrate(row) : null;
}

/**
 * Guarda la dirección. Si es la misma que ya estaba verificada, no toca nada.
 * Si es nueva, la deja sin verificar y devuelve el token para mandar por mail.
 */
export function set(
  companyId: string,
  kind: CompanyEmailKind,
  raw: string,
  now: Date = new Date(),
): Result<{ token: string | null }> {
  const email = raw.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "ese correo no parece válido" };
  }

  const current = get(companyId, kind);
  if (current && current.email === email && (email === "" || current.verified)) {
    return { ok: true, value: { token: null } };
  }

  if (email === "") {
    db().run("DELETE FROM company_emails WHERE company_id = ? AND kind = ?", [companyId, kind]);
    return { ok: true, value: { token: null } };
  }

  const stamp = now.toISOString();
  const { token, hash, expires } = mintToken();

  db().run(
    `INSERT INTO company_emails
       (company_id, kind, email, verified, token_hash, token_expires, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?)
     ON CONFLICT (company_id, kind) DO UPDATE SET
       email = excluded.email,
       verified = 0,
       token_hash = excluded.token_hash,
       token_expires = excluded.token_expires,
       updated_at = excluded.updated_at`,
    [companyId, kind, email, hash, expires, current?.created_at ?? stamp, stamp],
  );

  return { ok: true, value: { token } };
}

/** Confirma el correo con el token que llegó por mail. */
export function verify(
  companyId: string,
  kind: CompanyEmailKind,
  token: string,
  now: Date = new Date(),
): boolean {
  const row = db()
    .query<{ token_hash: string; token_expires: string }, [string, string]>(
      "SELECT token_hash, token_expires FROM company_emails WHERE company_id = ? AND kind = ?",
    )
    .get(companyId, kind);
  if (!row || !row.token_hash || !token) return false;
  if (row.token_hash !== sha256(token)) return false;
  if (Date.parse(row.token_expires) < now.getTime()) return false;

  db().run(
    "UPDATE company_emails SET verified = 1, token_hash = '', token_expires = '', updated_at = ? WHERE company_id = ? AND kind = ?",
    [now.toISOString(), companyId, kind],
  );
  return true;
}

/** Un token nuevo para reenviar el correo, sin perder la dirección cargada. */
export function refreshToken(
  companyId: string,
  kind: CompanyEmailKind,
  now: Date = new Date(),
): Result<string> {
  const current = get(companyId, kind);
  if (!current || !current.email) return { ok: false, error: "no hay un correo cargado" };
  if (current.verified) return { ok: false, error: "ese correo ya está verificado" };

  const { token, hash, expires } = mintToken();
  db().run(
    "UPDATE company_emails SET token_hash = ?, token_expires = ?, updated_at = ? WHERE company_id = ? AND kind = ?",
    [hash, expires, now.toISOString(), companyId, kind],
  );
  return { ok: true, value: token };
}
