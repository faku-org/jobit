import { decrypt, encrypt } from "./crypto.ts";
import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Llevar lo que alguien eligió de un navegador a otro.
 *
 * El servidor no interpreta el contenido: recibe un JSON, lo cifra en reposo
 * con la misma clave que el email y el TOTP, y lo devuelve tal cual. Sin esa
 * clave configurada el sync queda apagado, igual que el 2FA.
 */
const MAX_BYTES = 512 * 1024;

export interface SyncedPayload {
  payload: string;
  updatedAt: string;
}

export async function pull(userId: string): Promise<Result<SyncedPayload | null>> {
  const row = db()
    .query<{ payload_enc: string; updated_at: string }, [string]>(
      "SELECT payload_enc, updated_at FROM user_sync WHERE user_id = ?",
    )
    .get(userId);

  if (!row) return { ok: true, value: null };

  const plain = await decrypt(row.payload_enc);
  if (!plain.ok) return plain;
  return { ok: true, value: { payload: plain.value, updatedAt: row.updated_at } };
}

/** Pisa el anterior: el navegador manda el estado entero en cada cambio. */
export async function push(
  userId: string,
  payload: string,
  now: Date = new Date(),
): Promise<Result<string>> {
  if (payload.length > MAX_BYTES) {
    return { ok: false, error: "lo que querés sincronizar es demasiado grande" };
  }

  const encrypted = await encrypt(payload);
  if (!encrypted.ok) return encrypted;

  const stamp = now.toISOString();
  db().run(
    `INSERT INTO user_sync (user_id, payload_enc, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload_enc = excluded.payload_enc, updated_at = excluded.updated_at`,
    [userId, encrypted.value, stamp],
  );
  return { ok: true, value: stamp };
}

/** Apagar el sync es olvidar lo guardado, no dejar de mirarlo. */
export function clear(userId: string): void {
  db().run("DELETE FROM user_sync WHERE user_id = ?", [userId]);
}
