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

/* El token nunca se guarda: solo su sha256, así que una copia de la base no
   alcanza para hacerse pasar por una sesión abierta. */
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash  TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions (expires_at);
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
