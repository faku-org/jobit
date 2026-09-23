import { timingSafeEqual } from "./crypto.ts";

/**
 * TOTP (RFC 6238) con HMAC-SHA1, armado sobre `crypto.subtle`.
 *
 * El secreto no sale del servidor en una imagen: el cliente dibuja el QR a
 * partir del `otpauth://`. La ventana de un paso para atrás y uno para adelante
 * es la que tolera un reloj corrido sin abrir de más.
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SECRET_BYTES = 20;
const STEP_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array | null {
  const clean = text.toUpperCase().replace(/[\s=]/g, "");
  if (clean.length === 0) return null;

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of clean) {
    const index = BASE32.indexOf(character);
    if (index < 0) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/** 160 bits, como recomienda el RFC. */
export const generateSecret = (): string =>
  base32Encode(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));

async function hotp(secret: Uint8Array, counter: number, digits: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const message = new Uint8Array(8);
  let remaining = counter;
  for (let index = 7; index >= 0; index--) {
    message[index] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }

  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** El código de un instante dado. `null` si el secreto no es base32 válido. */
export async function totp(
  secret: string,
  at: number = Date.now(),
  digits = 6,
  stepSeconds = STEP_SECONDS,
): Promise<string | null> {
  const bytes = base32Decode(secret);
  if (!bytes) return null;
  return hotp(bytes, Math.floor(at / 1000 / stepSeconds), digits);
}

export interface TotpCheck {
  ok: boolean;
}

/** Acepta el paso actual y los `window` de cada lado. */
export async function verifyTotp(
  secret: string,
  code: string,
  at: number = Date.now(),
  window = 1,
): Promise<TotpCheck> {
  const candidate = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return { ok: false };

  for (let step = -window; step <= window; step++) {
    const expected = await totp(secret, at + step * STEP_SECONDS * 1000);
    if (expected && timingSafeEqual(expected, candidate)) return { ok: true };
  }
  return { ok: false };
}

export const otpauthUrl = (options: {
  secret: string;
  account: string;
  issuer: string;
}): string => {
  const label = `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.account)}`;
  const params = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};
