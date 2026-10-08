/**
 * El lado matemático de la búsqueda semántica: empaquetar un vector para
 * guardarlo en SQLite, medir cuánto se parecen dos y armar el texto que se le
 * manda al embedder. Nada de acá toca la red ni la base, así que se puede
 * probar entero con `bun test`.
 */

/** Cuántas dimensiones tiene el modelo del VPS. Se guarda por fila igual: el
 * día que cambie de modelo la base lo dice sin tener que adivinarlo. */
export const EMBEDDING_DIM = 768;

/** Los vectores llegan L2-normalizados del embedder, así que el producto
 * punto ya es el coseno. Igual calculamos el coseno de verdad: no cuesta nada
 * y no deja la corrección colgada de una promesa del otro lado. */
export function dot(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

const norm = (vector: Float32Array): number => Math.sqrt(dot(vector, vector));

/** Coseno en [-1, 1]; 0 cuando no hay con qué comparar. */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/**
 * Float32Array -> bytes para el BLOB. A propósito little-endian y explícito:
 * el formato no depende del orden de bytes de la máquina y una copia de la
 * base se lee igual en cualquier lado.
 */
export function encodeVector(vector: Float32Array): Uint8Array {
  const bytes = new Uint8Array(vector.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < vector.length; i++) view.setFloat32(i * 4, vector[i] ?? 0, true);
  return bytes;
}

/** Bytes -> Float32Array. Descarta una cola que no complete cuatro bytes en
 * vez de reventar por una fila corrupta. */
export function decodeVector(blob: Uint8Array): Float32Array {
  const usable = blob.byteLength - (blob.byteLength % 4);
  const view = new DataView(blob.buffer, blob.byteOffset, usable);
  const vector = new Float32Array(usable / 4);
  for (let i = 0; i < vector.length; i++) vector[i] = view.getFloat32(i * 4, true);
  return vector;
}

/**
 * El texto que representa a la oferta para el embedder. Solo el título, la
 * descripción y los requisitos: es lo que un aviso tiene de sustancia y lo que
 * alguien describe con palabras cuando busca ("diseño de producto sin
 * experiencia"), aunque esas palabras no estén escritas en ningún lado.
 */
export function offerText(parts: {
  title?: string | null;
  description?: string | null;
  requirements?: string | null;
}): string {
  return [parts.title, parts.description, parts.requirements]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join("\n");
}
