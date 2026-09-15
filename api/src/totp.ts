/**
 * Segundo factor por TOTP (RFC 6238), que es el único que no obliga a mandar
 * nada a nadie: no hay SMS, no hay correo de salida y el secreto no sale del
 * servidor más que una vez, cuando la persona lo escanea.
 *
 * HMAC-SHA1 porque es lo que implementan todas las apps de autenticación. El
 * algoritmo es viejo pero acá se usa como MAC de un contador de 8 bytes con
 * una clave de 20, que es exactamente para lo que sigue estando bien.
 *
 * El QR se arma en el navegador a partir del `otpauth://`: no hace falta que
 * el secreto pase por una imagen generada en el servidor.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Un paso para adelante y uno para atrás: alcanza para un reloj corrido y no
 * estira la ventana de un código robado más de un minuto y medio. */
const WINDOW = 1;
const SECRET_BYTES = 20;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

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

/** Null si trae algo que no es base32: un secreto mal copiado no es un
 * secreto, y tratarlo como bytes cualquiera daría códigos que nunca coinciden
 * sin decir por qué. */
export function base32Decode(text: string): Uint8Array | null {
  const clean = text.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
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
  return new Uint8Array(bytes);
}

export const newSecret = (): string =>
  base32Encode(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));

/** El contador de 8 bytes, big endian, que manda el RFC. */
function counterBytes(counter: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(counter));
  return new Uint8Array(buffer);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, [
    "sign",
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));

  /** Truncado dinámico: los últimos cuatro bits dicen de dónde salen los
   * cuatro bytes que importan. */
  const offset = (mac[mac.length - 1] ?? 0) & 15;
  const binary =
    (((mac[offset] ?? 0) & 127) << 24) |
    (((mac[offset + 1] ?? 0) & 255) << 16) |
    (((mac[offset + 2] ?? 0) & 255) << 8) |
    ((mac[offset + 3] ?? 0) & 255);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export async function totpCode(
  secret: string,
  now: Date = new Date(),
  skew = 0,
): Promise<string | null> {
  const bytes = base32Decode(secret);
  if (!bytes || bytes.length === 0) return null;

  const counter = Math.floor(now.getTime() / 1000 / STEP_SECONDS) + skew;
  return hotp(bytes, counter);
}

/**
 * Compara en tiempo constante. El código dura treinta segundos, así que el
 * tiempo que tarda una comparación no alcanza para adivinarlo; igual no cuesta
 * nada y evita tener que razonarlo de nuevo cada vez que alguien lee esto.
 */
function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyTotp(
  secret: string,
  code: string,
  now: Date = new Date(),
): Promise<boolean> {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;

  for (let skew = -WINDOW; skew <= WINDOW; skew++) {
    const expected = await totpCode(secret, now, skew);
    if (expected && sameCode(expected, clean)) return true;
  }
  return false;
}

/** Lo que el navegador convierte en QR. El label lleva el handle y no el
 * correo, porque el correo puede no existir. */
export function otpauthUrl(handle: string, secret: string, issuer = "JobIt"): string {
  const label = encodeURIComponent(`${issuer}:${handle}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
