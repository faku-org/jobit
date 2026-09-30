import { readFileSync } from "node:fs";
import type { Result } from "./types.ts";

/**
 * El cifrado en reposo del email y del secreto TOTP.
 *
 * AES-256-GCM con WebCrypto. La clave vive en un archivo
 * (`JOBIT_SECRET_KEY_FILE`) por la misma razón que el hash del panel y el token
 * de ingesta: nadie interpola un archivo. `JOBIT_SECRET_KEY` inline sirve para
 * desarrollo.
 *
 * Sin clave configurada el email y el 2FA quedan apagados y el alta sin email
 * sigue andando. Falla cerrado, no abierto.
 */
const KEY_BYTES = 32;
const IV_BYTES = 12;

/** Se lee una sola vez: el proceso no cambia de clave en caliente. */
let keyPromise: Promise<CryptoKey | null> | null = null;
let rawKeyCache: Uint8Array | null | undefined;

function keyText(): string {
  const path = process.env.JOBIT_SECRET_KEY_FILE;
  if (path) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      // Un archivo ilegible deja el cifrado apagado, que es como tiene que fallar.
      return "";
    }
  }
  return (process.env.JOBIT_SECRET_KEY ?? "").trim();
}

/** Acepta base64 o base64url, que es como la deja cualquiera de las dos formas
 * de generarla, y también hex: 64 caracteres hexadecimales son los mismos 32
 * bytes de AES-256 y es como la escribe media docena de generadores. */
function decodeKey(text: string): Uint8Array | null {
  if (!text) return null;
  if (/^[0-9a-fA-F]{64}$/.test(text)) return new Uint8Array(Buffer.from(text, "hex"));

  const normalised = text.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Buffer.from(normalised, "base64");
  return bytes.length === KEY_BYTES ? new Uint8Array(bytes) : null;
}

function rawKey(): Uint8Array | null {
  if (rawKeyCache === undefined) rawKeyCache = decodeKey(keyText());
  return rawKeyCache;
}

async function loadKey(): Promise<CryptoKey | null> {
  const bytes = rawKey();
  if (!bytes) return null;
  try {
    return await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } catch {
    return null;
  }
}

export function secretKey(): Promise<CryptoKey | null> {
  keyPromise ??= loadKey();
  return keyPromise;
}

export const encryptionEnabled = async (): Promise<boolean> => (await secretKey()) !== null;

/** El dato sale como base64url del iv pegado adelante del criptograma. */
export async function encrypt(plain: string): Promise<Result<string>> {
  const key = await secretKey();
  if (!key) return { ok: false, error: "no hay clave de cifrado configurada" };

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );

  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return { ok: true, value: Buffer.from(out).toString("base64url") };
}

export async function decrypt(payload: string): Promise<Result<string>> {
  const key = await secretKey();
  if (!key) return { ok: false, error: "no hay clave de cifrado configurada" };

  const bytes = Buffer.from(payload, "base64url");
  if (bytes.length <= IV_BYTES) {
    return { ok: false, error: "el dato cifrado está incompleto" };
  }

  const iv = bytes.subarray(0, IV_BYTES);
  const cipher = bytes.subarray(IV_BYTES);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return { ok: true, value: new TextDecoder().decode(plain) };
  } catch {
    // Cambió la clave o alguien tocó el dato: no hay forma de saber cuál de las dos.
    return { ok: false, error: "no se pudo descifrar el dato" };
  }
}

/**
 * Firma con HMAC-SHA256 sobre la misma clave. La usa el desafío de dos pasos,
 * que tiene que sobrevivir entre dos peticiones sin tabla propia.
 */
export async function sign(payload: string): Promise<Result<string>> {
  const bytes = rawKey();
  if (!bytes) return { ok: false, error: "no hay clave configurada" };

  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return { ok: true, value: Buffer.from(mac).toString("hex") };
}

export async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const expected = await sign(payload);
  if (!expected.ok) return false;
  return timingSafeEqual(expected.value, signature);
}

/** Compara dos textos sin cortar en la primera letra distinta. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= (a.charCodeAt(index) ?? 0) ^ (b.charCodeAt(index) ?? 0);
  }
  return diff === 0;
}

/** Solo para los tests: deja el módulo como recién cargado. */
export function resetSecretKey(): void {
  keyPromise = null;
  rawKeyCache = undefined;
}
