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

/* Quien publica un servicio. Nada de esto se cruza con el admin: son dos
   sesiones distintas y ninguna sirve para la otra. El email es opcional y va
   cifrado porque solo existe para recuperar la cuenta; el secreto TOTP, por la
   misma razón, tampoco se guarda en claro. */
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  handle          TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  email_enc       TEXT,
  totp_secret_enc TEXT,
  totp_enabled    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS users_handle ON users (handle);

/* Igual que admin_sessions: solo el sha256 del token, nunca el token. */
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expiry ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions (user_id);

/* Los códigos de respaldo se guardan hasheados y se muestran una sola vez. */
CREATE TABLE IF NOT EXISTS user_recovery_codes (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, code_hash)
);

/* Lo que alguien eligió llevar de un navegador a otro. Es un JSON opaco para el
   servidor y va cifrado en reposo, igual que el email: sin clave configurada el
   sync queda apagado. Se borra solo cuando se borra la cuenta. */
CREATE TABLE IF NOT EXISTS user_sync (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload_enc TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

/* Lo que alguien ofrece hacer, que no es una oferta de empleo y no entra en
   /api/jobs. Borrar la cuenta se lleva sus servicios: no tienen sentido sin
   quien los presta.

   rating_avg y rating_count los escribe la calificación y acá solo se leen.
   Nada llega a 'published' sin pasar por moderación. */
CREATE TABLE IF NOT EXISTS services (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  summary           TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'otros',
  department        TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  remote            TEXT NOT NULL DEFAULT '',
  fixed_price       INTEGER NOT NULL DEFAULT 0,
  work_style        TEXT NOT NULL DEFAULT '',
  experience_years  INTEGER,
  availability_note TEXT NOT NULL DEFAULT '',
  response_time     TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'draft',
  rating_avg        REAL NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  published_at      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS services_feed ON services (status, published_at DESC);
CREATE INDEX IF NOT EXISTS services_user ON services (user_id);
CREATE INDEX IF NOT EXISTS services_category ON services (status, category);

/* El orden es la prioridad que le da quien publica, no un detalle de cómo se
   dibuja. */
CREATE TABLE IF NOT EXISTS service_skills (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  skill      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service_id, skill)
);

/* Los extras no son otra tabla: son filas con kind = 'extra'. Se muestran
   distinto y son lo mismo. El monto se guarda como se publicó y no se
   convierte nunca. */
CREATE TABLE IF NOT EXISTS service_prices (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'base',
  label      TEXT NOT NULL DEFAULT '',
  amount     INTEGER NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'UYU',
  unit       TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS service_prices_service ON service_prices (service_id);

/* "from" y "to" son palabras reservadas en SQL, así que las columnas llevan
   el sufijo. Las horas son HH:MM y el día es 0 (domingo) a 6. */
CREATE TABLE IF NOT EXISTS service_hours (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL,
  from_time  TEXT NOT NULL,
  to_time    TEXT NOT NULL,
  PRIMARY KEY (service_id, weekday, from_time)
);

/* Lo que dijo el filtro la última vez que el servicio pidió publicarse. El
   puntaje ordena la cola y los motivos la explican; decidir sigue siendo de
   una persona, salvo lo inequívoco. */
CREATE TABLE IF NOT EXISTS moderation_reviews (
  service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL DEFAULT 0,
  reasons    TEXT NOT NULL DEFAULT '[]',
  decision   TEXT NOT NULL DEFAULT 'queue',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS moderation_reviews_score ON moderation_reviews (score DESC);

/* Para reconocer que el mismo contenido volvió hace falta acordarse de lo
   rechazado. Se guarda el hash del texto y su firma MinHash, que no se puede
   volver texto: alcanza para el dedupe y no deja el contenido de nadie
   guardado en una tabla de descartes. */
CREATE TABLE IF NOT EXISTS moderation_prints (
  text_hash  TEXT PRIMARY KEY,
  service_id TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL,
  signature  TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS moderation_prints_kind ON moderation_prints (kind);

/* La denuncia desde la ficha pública, que alimenta la misma cola. Sin quién
   denunció: un motivo de una lista corta y el día. */
CREATE TABLE IF NOT EXISTS service_reports (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  handled    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS service_reports_service ON service_reports (service_id, handled);

/* La calificación: un voto por persona y por servicio, y nadie se califica a
   sí mismo (lo revisa el modelo, que es quien sabe de quién es el servicio).

   Borrar la cuenta no borra la reseña, le saca el autor: la nota es de un
   tercero y sigue valiendo. Por eso el autor es SET NULL y no CASCADE, y por
   eso el UNIQUE tolera varias filas sin autor, que en SQLite son distintas
   entre sí.

   created_at es el día, como todo el resto: la hora exacta de una acción es
   un dato que correlaciona personas.

   La respuesta de quien publica es una sola: esto no es un hilo. Y edited
   marca la única corrección que se permite. */
CREATE TABLE IF NOT EXISTS service_reviews (
  id             TEXT PRIMARY KEY,
  service_id     TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rating         INTEGER NOT NULL,
  comment        TEXT NOT NULL DEFAULT '',
  reply          TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'visible',
  edited         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  UNIQUE (service_id, author_user_id)
);

CREATE INDEX IF NOT EXISTS service_reviews_service ON service_reviews (service_id, status);

/* Denunciar una reseña va a la misma cola que denunciar el servicio, pero en
   su propia tabla: el servicio se sigue viendo y lo que hay que mirar es una
   fila de adentro. Tampoco guarda quién denunció. */
CREATE TABLE IF NOT EXISTS review_reports (
  review_id  TEXT NOT NULL REFERENCES service_reviews(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  handled    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS review_reports_service ON review_reports (service_id, handled);
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
