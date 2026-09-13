/**
 * TOTP (RFC 6238) con lo que ya trae la plataforma: HMAC-SHA1 por
 * `crypto.subtle` y nada más. Es el segundo paso opcional del login, así que
 * tiene que poder verificarse sin red y sin servicio de nadie.
 *
 * El QR lo arma el cliente a partir del `otpauth://`: el secreto no tiene por
 * qué pasar por una imagen generada en el servidor.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Base32 sin relleno, que es lo que leen las apps de autenticación. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Null si trae algo que no es base32: un secreto mal copiado no es un secreto. */
export function base32Decode(text: string): Uint8Array | null {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  if (!clean) return null;

  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;

    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Uint8Array.from(bytes);
}

const SECRET_BYTES = 20;

export const generateTotpSecret = (): string =>
  base32Encode(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

/**
 * Una ventana de un paso para cada lado: el reloj del teléfono corre y quien
 * tipea seis dígitos a veces llega tarde. Más ventana que esa es regalar
 * intentos.
 */
const WINDOW_STEPS = 1;

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, message));
}

const counterBytes = (step: number): Uint8Array => {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(step));
  return new Uint8Array(buffer);
};

/** Null si el secreto no es base32 válido. */
export async function totpCode(secret: string, at: Date = new Date()): Promise<string | null> {
  const key = base32Decode(secret);
  if (!key || key.length === 0) return null;

  const step = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  return codeForStep(key, step);
}

async function codeForStep(key: Uint8Array, step: number): Promise<string> {
  const digest = await hmacSha1(key, counterBytes(step));

  /** Truncado dinámico: los últimos cuatro bits dicen de dónde sacar el número. */
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/**
 * No se recuerda el paso ya usado: un código sirve mientras dura su ventana,
 * y recordarlo pediría guardar la hora exacta de un inicio de sesión, que es
 * justo lo que la política dice que no se guarda.
 */
export async function totpValid(
  secret: string,
  code: string,
  at: Date = new Date(),
): Promise<boolean> {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;

  const key = base32Decode(secret);
  if (!key || key.length === 0) return false;

  const current = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  for (let drift = -WINDOW_STEPS; drift <= WINDOW_STEPS; drift++) {
    if ((await codeForStep(key, current + drift)) === clean) return true;
  }
  return false;
}

/** El `otpauth://` que la app de autenticación espera adentro del QR. */
export function otpauthUrl(secret: string, handle: string, issuer = "JobIt"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(handle)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
