import { readFileSync } from "node:fs";

/**
 * Lo poco que se guarda de una persona y no puede quedar en claro: el correo,
 * que es opcional y solo sirve para recuperar la cuenta, y el secreto TOTP,
 * que en claro es la segunda credencial entera.
 *
 * La clave vive en el entorno, igual que el hash del panel:
 *
 *   USER_SECRET_KEY_FILE=/home/hermes/deploy/env/jobit.key
 *   USER_SECRET_KEY=cualquier frase larga
 *
 * Sin clave no se cifra nada, y lo que necesitaría cifrarse se rechaza en vez
 * de guardarse en claro. Una cuenta sin correo y sin 2FA sigue andando: son
 * las dos cosas opcionales, así que el sistema no se cae, se queda sin ellas.
 */
export function secretKeyMaterial(): string {
  const path = process.env.USER_SECRET_KEY_FILE;
  if (path) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      // Un archivo ilegible deja el cifrado apagado, que es como tiene que fallar.
      return "";
    }
  }
  return (process.env.USER_SECRET_KEY ?? "").trim();
}

export const secretsEnabled = (): boolean => secretKeyMaterial().length > 0;

let cached: { material: string; key: CryptoKey } | null = null;

/**
 * La frase se pasa por sha256 para llegar a los 32 bytes que pide AES-256.
 * Así cualquier cosa que alguien ponga en el entorno sirve como clave, sin
 * pedirle que sepa generar base64 de largo exacto.
 */
async function aesKey(): Promise<CryptoKey | null> {
  const material = secretKeyMaterial();
  if (!material) return null;
  if (cached?.material === material) return cached.key;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);

  cached = { material, key };
  return key;
}

const IV_BYTES = 12;

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

/** Devuelve `v1.<iv>.<cifrado>`, o null si no hay clave configurada. */
export async function encryptSecret(plain: string): Promise<string | null> {
  const key = await aesKey();
  if (!key) return null;

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );

  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
}

/**
 * Null si falta la clave, si el formato no es el esperado o si el texto fue
 * tocado: GCM valida, así que una fila editada a mano no se descifra sola.
 */
export async function decryptSecret(packed: string): Promise<string | null> {
  if (!packed) return null;

  const key = await aesKey();
  if (!key) return null;

  const [version, iv, payload] = packed.split(".");
  if (version !== "v1" || !iv || !payload) return null;

  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
      key,
      Buffer.from(payload, "base64url"),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
