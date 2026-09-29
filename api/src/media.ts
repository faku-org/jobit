import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Result } from "./types.ts";

/**
 * Las imágenes de la empresa: el logo y el banner.
 *
 * Van a disco y no a la base: son binarios, se sirven tal cual y no hace falta
 * consultarlos por SQL. La ruta y el nombre los fija el servidor; lo único que
 * el cliente elige es el contenido del archivo, y hasta eso se valida por los
 * bytes de la cabecera y no por el `content-type`, que lo manda él.
 */
export const MEDIA_KINDS = ["logo", "banner"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const isKind = (value: unknown): value is MediaKind =>
  (MEDIA_KINDS as readonly unknown[]).includes(value);

interface Format {
  ext: string;
  type: string;
}

/** Un megabyte para el logo y cuatro para el banner: es lo que distingue a los dos. */
export const MAX_BYTES: Record<MediaKind, number> = {
  logo: 1_000_000,
  banner: 4_000_000,
};

export function uploadsDir(): string {
  const configured = process.env.UPLOADS_DIR;
  return configured ? resolve(configured) : resolve(import.meta.dir, "../../data/uploads");
}

const startsWith = (bytes: Uint8Array, signature: number[]): boolean =>
  signature.every((value, index) => bytes[index] === value);

const asciiAt = (bytes: Uint8Array, offset: number, text: string): boolean => {
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
};

/** Reconoce el formato por la cabecera. Devuelve null si no es una imagen de
 * las que se aceptan, sin importar lo que diga el cliente. */
export function detectFormat(bytes: Uint8Array): Format | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { ext: "png", type: "image/png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", type: "image/jpeg" };
  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) return { ext: "webp", type: "image/webp" };
  if (asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a")) {
    return { ext: "gif", type: "image/gif" };
  }
  return null;
}

const fileBase = (companyId: string, kind: MediaKind): string => `${companyId}-${kind}`;

/** La ruta pública que se guarda en la fila de la empresa. */
export const publicUrl = (companyId: string, kind: MediaKind): string =>
  `/api/empresas/media/${companyId}/${kind}`;

/** Los ids son UUID; cualquier otra cosa en la URL no puede llegar al disco. */
export const isSafeId = (value: string): boolean => /^[0-9a-fA-F-]{36}$/.test(value);

/** Borra cualquier archivo previo de esa empresa y ese tipo, sea cual sea su extensión. */
function clearExisting(companyId: string, kind: MediaKind): void {
  const dir = uploadsDir();
  if (!existsSync(dir)) return;
  const base = fileBase(companyId, kind);
  for (const name of readdirSync(dir)) {
    if (name.startsWith(`${base}.`)) unlinkSync(join(dir, name));
  }
}

export function save(companyId: string, kind: MediaKind, bytes: Uint8Array): Result<string> {
  if (bytes.byteLength === 0) return { ok: false, error: "el archivo está vacío" };
  if (bytes.byteLength > MAX_BYTES[kind]) {
    return {
      ok: false,
      error: `la imagen supera el máximo de ${Math.round(MAX_BYTES[kind] / 1_000_000)} MB`,
    };
  }

  const format = detectFormat(bytes);
  if (!format) return { ok: false, error: "tiene que ser una imagen PNG, JPG, WEBP o GIF" };

  const dir = uploadsDir();
  mkdirSync(dirname(join(dir, "x")), { recursive: true });
  clearExisting(companyId, kind);
  writeFileSync(join(dir, `${fileBase(companyId, kind)}.${format.ext}`), bytes);
  return { ok: true, value: publicUrl(companyId, kind) };
}

export function remove(companyId: string, kind?: MediaKind): void {
  if (kind) {
    clearExisting(companyId, kind);
    return;
  }
  clearExisting(companyId, "logo");
  clearExisting(companyId, "banner");
}

export interface Stored {
  bytes: Uint8Array;
  type: string;
}

/** El archivo en disco, o null si esa empresa no tiene imagen de ese tipo. */
export function read(companyId: string, kind: MediaKind): Stored | null {
  const dir = uploadsDir();
  if (!existsSync(dir) || !isSafeId(companyId)) return null;

  const base = fileBase(companyId, kind);
  const name = readdirSync(dir).find((entry) => entry.startsWith(`${base}.`));
  if (!name) return null;

  const bytes = readFileSync(join(dir, name));
  const format = detectFormat(bytes) ?? { ext: "bin", type: "application/octet-stream" };
  return { bytes: new Uint8Array(bytes), type: format.type };
}
