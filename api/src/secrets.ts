import { readFileSync } from "node:fs";

/**
 * Lo poco que se guarda de una persona y que no debería salir en una copia de
 * la base: el correo de recuperación, si lo dejó, y el secreto del segundo
 * factor. Todo lo demás de una cuenta es público por definición (el handle, el
 * nombre visible) o ya es irreversible (el hash de la contraseña).
 *
 * AES-256-GCM con una clave del entorno. GCM y no CBC porque el texto cifrado
 * viene autenticado: un secreto TOTP al que alguien con acceso al disco le
 * cambió un byte tiene que fallar al descifrar, no descifrar cualquier cosa.
 *
 * La clave se genera con:
 *   bun -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"))'
 *
 * Sin ACCOUNT_KEY las cuentas quedan apagadas enteras, igual que el panel sin
 * su hash. Es a propósito: un despliegue al que se le olvidó la variable tiene
 * que quedarse sin cuentas, no guardando correos en claro.
 */
const KEY_BYTES = 32;
const IV_BYTES = 12;
const PREFIX = "v1";

/** Un archivo con la clave y nada más le gana a la variable, por lo mismo que
 * ya pasa con el hash del admin: nadie interpola un archivo en el camino. */
function rawKey(): string {
  const path = process.env.ACCOUNT_KEY_FILE;
  if (path) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      return "";
    }
  }
  return (process.env.ACCOUNT_KEY ?? "").trim();
}

let cached: { raw: string; key: CryptoKey } | null = null;

/** Devuelve null si falta la clave o si no mide 32 bytes: media clave no es
 * una clave, y arrancar con ella sería guardar secretos con algo que nadie
 * revisó. */
async function key(): Promise<CryptoKey | null> {
  const raw = rawKey();
  if (!raw) return null;
  if (cached?.raw === raw) return cached.key;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  if (bytes.length !== KEY_BYTES) return null;

  const imported = await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  cached = { raw, key: imported };
  return imported;
}

/** Si esto da false, /api/auth y /api/services contestan 404 enteros. */
export function accountsEnabled(): boolean {
  const raw = rawKey();
  if (!raw) return false;
  try {
    return Buffer.from(raw, "base64").length === KEY_BYTES;
  } catch {
    return false;
  }
}

/** Solo los tests necesitan esto: la clave no cambia mientras el proceso vive,
 * y el caché ya se invalida solo si el valor del entorno cambia. */
export function resetSecretsCache(): void {
  cached = null;
}

/** `v1.<iv en base64url>.<cifrado en base64url>`. La versión adelante para que
 * el día que haya que rotar algoritmo se pueda leer lo viejo. */
export async function seal(plain: string): Promise<string> {
  if (!plain) return "";

  const secret = await key();
  if (!secret) throw new Error("falta ACCOUNT_KEY: no hay con qué cifrar");

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    secret,
    new TextEncoder().encode(plain),
  );

  return [
    PREFIX,
    Buffer.from(iv).toString("base64url"),
    Buffer.from(cipher).toString("base64url"),
  ].join(".");
}

/**
 * Null cuando el texto no se puede descifrar, y no una excepción: una fila
 * cifrada con una clave anterior es un dato que se perdió, no una caída de la
 * API. Quien la lee decide qué hacer, que casi siempre es tratarla como
 * ausente.
 */
export async function open(sealed: string): Promise<string | null> {
  if (!sealed) return null;

  const [prefix, ivPart, cipherPart] = sealed.split(".");
  if (prefix !== PREFIX || !ivPart || !cipherPart) return null;

  const secret = await key();
  if (!secret) return null;

  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(ivPart, "base64url") },
      secret,
      Buffer.from(cipherPart, "base64url"),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
