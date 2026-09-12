import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Everything the board itself is stays in the scraper's JSON: it is rebuilt
 * whole on every run and nothing in the app writes to it. This file is for
 * what the app owns instead, starting with the companies somebody has to
 * approve before they can publish.
 */
export const IN_MEMORY = ":memory:";

/** `:memory:` no es una ruta y resolverlo la rompe, sobre todo en Windows,
 * donde los dos puntos no van en un nombre de archivo. */
export const dbFilePath = (): string => {
  const configured = process.env.DB_FILE;
  if (!configured) return resolve(import.meta.dir, "../../data/jobit.db");
  return configured === IN_MEMORY ? IN_MEMORY : resolve(configured);
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL DEFAULT '',
  website     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS companies_status ON companies (status, name);

/* Las ofertas que se publican acá, no las que scrapea el worker. Borrar la
   empresa se lleva las suyas: no tienen sentido sin ella. */
CREATE TABLE IF NOT EXISTS offers (
  id                   TEXT PRIMARY KEY,
  company_id           TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  requirements         TEXT NOT NULL DEFAULT '',
  category             TEXT NOT NULL DEFAULT 'otros',
  department           TEXT NOT NULL DEFAULT '',
  city                 TEXT NOT NULL DEFAULT '',
  level                TEXT NOT NULL DEFAULT '',
  remote               TEXT NOT NULL DEFAULT '',
  job_type             TEXT NOT NULL DEFAULT '',
  salary_min           INTEGER,
  salary_max           INTEGER,
  no_experience        INTEGER NOT NULL DEFAULT 0,
  experience_years_min INTEGER,
  closes_at            TEXT NOT NULL DEFAULT '',
  apply_url            TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'draft',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  published_at         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS offers_feed ON offers (status, published_at DESC);
CREATE INDEX IF NOT EXISTS offers_company ON offers (company_id);

/* El token nunca se guarda: solo su sha256, así que una copia de la base no
   alcanza para hacerse pasar por una sesión abierta. */
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash  TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions (expires_at);

/* Las cuentas de quien publica un servicio. No se cruzan con el admin, que
   sigue sin tabla: su credencial vive en el entorno.

   Se guarda lo mínimo para poder volver a entrar y editar lo propio. El correo
   es opcional y solo sirve para recuperar la cuenta, así que va cifrado en
   reposo, igual que el secreto TOTP. Nada de IP, user agent ni historial de
   inicios de sesión, y las fechas son el día y no el momento: la hora exacta
   de lo que hace alguien no hace falta para que esto funcione. */
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  handle          TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  email_enc       TEXT NOT NULL DEFAULT '',
  totp_secret_enc TEXT NOT NULL DEFAULT '',
  totp_enabled    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

/* Copia la forma de admin_sessions: solo el sha256 del token, nunca el token.
   pending_totp marca la sesión que abrió el login pero todavía no pasó el
   segundo paso; no vale para nada hasta que lo pase. */
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pending_totp INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expiry ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions (user_id);

/* La única salida de quien no dejó correo. Se guardan hasheados y se muestran
   una sola vez. */
CREATE TABLE IF NOT EXISTS user_recovery_codes (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, code_hash)
);
`;

let handle: Database | null = null;

export function db(): Database {
  if (handle) return handle;

  const path = dbFilePath();
  if (path !== IN_MEMORY) mkdirSync(dirname(path), { recursive: true });

  const database = new Database(path, { create: true });
  /** WAL keeps a read from blocking the write that the admin panel is doing. */
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA foreign_keys = ON");
  database.run("PRAGMA busy_timeout = 5000");
  database.run(SCHEMA);

  handle = database;
  return database;
}

/** The tests drive a fresh database per file; nothing else needs this. */
export function closeDb(): void {
  handle?.close();
  handle = null;
}
