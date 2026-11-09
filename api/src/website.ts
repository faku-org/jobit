import { resolveTxt } from "node:dns/promises";

/**
 * La verificación del dominio de la empresa, por registro DNS TXT.
 *
 * El panel muestra un nombre y un valor para cargar en el DNS del dominio; la
 * API consulta ese TXT y, mientras exista, la URL queda verificada. Se vuelve a
 * consultar cada tanto porque un registro se puede borrar: la verificación es
 * un estado vivo, no una marca que se saca una vez y dura para siempre.
 */
export const RECORD_PREFIX = "_jobit";

/** Un resolver colgado no puede colgar el panel: se corta a los pocos segundos. */
const TIMEOUT_MS = 4000;

export type TxtResolver = (name: string) => Promise<string[][]>;

export function hostnameOf(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** El sufijo del TXT, para que dos cosas distintas no se confundan. */
export const challengeValue = (token: string): string => `jobit-verify=${token}`;

export function challengeName(hostname: string): string {
  return `${RECORD_PREFIX}.${hostname}`;
}

export function mintToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
}

async function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * ¿Existe el TXT con el valor esperado? Un dominio que no resuelve, un resolver
 * caído o un registro que no está dan lo mismo: no verificado.
 */
export async function hasRecord(
  hostname: string,
  token: string,
  resolver: TxtResolver = resolveTxt,
): Promise<boolean> {
  if (!hostname || !token) return false;
  const expected = challengeValue(token);

  let records: string[][];
  try {
    const resolved = await withTimeout(resolver(challengeName(hostname)));
    if (!resolved) return false;
    records = resolved;
  } catch {
    return false;
  }

  /** Cada registro TXT llega partido en trozos de 255 bytes; se unen. */
  return records.some((chunks) => chunks.join("").trim() === expected);
}
