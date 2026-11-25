import type { Database } from 'bun:sqlite'

/**
 * Lo que las métricas de empresa suman al esquema, en un bloque propio para no
 * mezclarlo con lo demás de `db.ts`.
 *
 * - `offer_daily.clicks`: el clic que abre el aviso original. Hasta acá
 *   `applies` contaba ese clic; desde ahora `applies` es la postulación que la
 *   persona confirma ("sí, la mandé") y `clicks` es el paso anterior del
 *   embudo.
 * - `company_alert_settings`: si la empresa quiere las alertas por correo.
 * - `alert_sent`: qué alerta salió y qué día, para no mandarla dos veces.
 *
 * Ninguna tabla guarda nada por persona: son contadores, una preferencia de la
 * empresa y marcas de "ya se avisó" por oferta.
 */
const TABLES = `
/* Una fila por empresa solo si tocó el interruptor. Sin fila, las alertas
   están prendidas: el correo dice cómo apagarlas. */
CREATE TABLE IF NOT EXISTS company_alert_settings (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  enabled    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

/* Una alerta enviada: de qué oferta, de qué clase y qué día. Es lo que vuelve
   idempotente al disparador diario, y se poda solo (ver alerts.ts). */
CREATE TABLE IF NOT EXISTS alert_sent (
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  kind     TEXT NOT NULL,
  day      TEXT NOT NULL,
  PRIMARY KEY (offer_id, kind, day)
);
`

/**
 * Agrega `offer_daily.clicks`. Es la única migración del repo que toca datos y
 * no solo suma una columna: lo que hasta ahora se guardó en `applies` era el
 * clic al aviso, así que en el mismo paso que crea `clicks` se pasa ese valor
 * ahí y `applies` vuelve a cero. Corre una sola vez: con la columna ya creada
 * no hace nada, así que reiniciar la API no vuelve a mover números.
 */
export function migrateMetrics(database: Database): void {
  database.run(TABLES)

  const present = database
    .query<{ name: string }, []>('PRAGMA table_info(offer_daily)')
    .all()
    .some((column) => column.name === 'clicks')
  if (present) return

  database.transaction(() => {
    database.run(
      'ALTER TABLE offer_daily ADD COLUMN clicks INTEGER NOT NULL DEFAULT 0',
    )
    database.run('UPDATE offer_daily SET clicks = applies, applies = 0')
  })()
}
