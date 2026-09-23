import { readFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { clearFeedCache } from "./feed.ts";
import { clearCache, jobsFilePath, loadJobs, parseJobsFile } from "./store.ts";

/**
 * Subir el resultado del scrapeo desde afuera del servidor.
 *
 * Existe por una razón concreta: BuscoJobs contesta 403 a la IP del VPS, y el
 * único lugar desde donde el scrapeo pasa es una máquina común. El worker corre
 * allá, y lo que produce entra por acá en vez de por el disco.
 *
 * La credencial es un token propio y no la sesión del panel: quien scrapea es
 * una máquina, no una persona, y lo único que tiene que poder hacer es
 * reemplazar el archivo de ofertas. Con el token del panel podría además tocar
 * empresas y ofertas propias.
 *
 * Sin token configurado la ruta contesta 404, igual que el panel: un despliegue
 * sin configurar se queda sin ingesta en vez de con una ingesta abierta.
 */
export function ingestToken(): string {
  const path = process.env.INGEST_TOKEN_FILE;
  if (path) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      // Un archivo ilegible deja la ingesta apagada, que es como tiene que fallar.
      return "";
    }
  }
  return (process.env.INGEST_TOKEN ?? "").trim();
}

export const ingestEnabled = (): boolean => ingestToken().length > 0;

const digest = (value: string): Buffer =>
  Buffer.from(new Bun.CryptoHasher("sha256").update(value).digest());

/** Compara los sha256 y no los tokens: quedan del mismo largo, así que el
 * tiempo de la comparación tampoco filtra cuántos caracteres tiene el bueno. */
function tokenMatches(presented: string): boolean {
  const expected = ingestToken();
  if (!expected || !presented) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

const bearer = (header: string | null): string => {
  if (!header) return "";
  const space = header.indexOf(" ");
  if (space < 0) return "";
  return header.slice(0, space).toLowerCase() === "bearer" ? header.slice(space + 1).trim() : "";
};

/** El worker manda el JSON comprimido, que son cinco megas contra medio. Un
 * `curl` a mano manda el JSON pelado, y las dos cosas entran: la firma de gzip
 * dice cuál es cuál. Descomprimir pasa después de validar el token, así que un
 * cuerpo inflado no es algo que pueda mandar cualquiera. */
function decode(bytes: Uint8Array<ArrayBuffer>): string {
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  return new TextDecoder().decode(gzipped ? Bun.gunzipSync(bytes) : bytes);
}

/** `parse: "arrayBuffer"` deja el cuerpo crudo, pero el tipo sigue siendo
 * unknown: acá se lo mira de verdad en vez de afirmarlo. */
function bytesOf(body: unknown): Uint8Array<ArrayBuffer> | null {
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    /** Una vista puede colgar de un SharedArrayBuffer, que no sirve para
     * descomprimir: copiarla la deja sobre un ArrayBuffer común. */
    const copy = new Uint8Array(body.byteLength);
    copy.set(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    return copy;
  }
  return null;
}

interface Written {
  count: number;
  scraped_at: string;
  previous_count: number;
}

/**
 * Escribe al lado y renombra. La API relee el archivo por mtime y sin
 * sincronizarse con nadie: si escribiera encima, una lectura que cae en el
 * medio se encuentra un JSON cortado por la mitad. El rename es atómico dentro
 * del mismo sistema de archivos, así que o se ve el archivo viejo entero o el
 * nuevo entero.
 */
async function write(file: string, body: string): Promise<void> {
  const temp = `${file}.tmp`;
  await Bun.write(temp, body);
  await rename(temp, file);
  clearCache();
  clearFeedCache();
}

export const ingest = new Elysia({ prefix: "/api/ingest" })
  .guard({
    beforeHandle({ request, status }) {
      if (!ingestEnabled()) return status(404, { error: "no encontrado" });
      if (!tokenMatches(bearer(request.headers.get("authorization")))) {
        return status(401, { error: "token inválido" });
      }
    },
  })
  .post(
    "/jobs",
    async ({ body, status }) => {
      const bytes = bytesOf(body);
      if (!bytes) return status(422, { error: "el cuerpo no llegó como bytes" });

      let raw: unknown;
      try {
        raw = JSON.parse(decode(bytes));
      } catch (cause) {
        return status(422, { error: `no se pudo leer el cuerpo: ${String(cause)}` });
      }

      const parsed = parseJobsFile(raw);
      if (!parsed.ok) return status(422, { error: parsed.error });

      /** Un archivo sin ofertas borraría el tablero. Es el mismo accidente que
       * evita `keepIfEmpty` en el worker, un paso más adelante. */
      if (parsed.value.jobs.length === 0) {
        return status(422, { error: "el archivo no trae ofertas" });
      }

      const current = await loadJobs();
      const previous = current.ok ? current.value : null;

      /** Subir dos veces el mismo archivo, o uno viejo que quedó dando vueltas
       * en otra máquina, no puede pisar algo más nuevo. */
      if (previous && parsed.value.scraped_at && previous.scraped_at > parsed.value.scraped_at) {
        return status(409, {
          error: `el archivo es más viejo que el que ya está (${previous.scraped_at})`,
        });
      }

      try {
        await write(jobsFilePath(), `${JSON.stringify(parsed.value, null, 2)}\n`);
      } catch (cause) {
        console.error(`[jobit] no se pudo escribir el archivo de ofertas: ${String(cause)}`);
        return status(503, { error: "no se pudo escribir el archivo de ofertas" });
      }

      const written: Written = {
        count: parsed.value.jobs.length,
        scraped_at: parsed.value.scraped_at,
        previous_count: previous?.jobs.length ?? 0,
      };
      console.log(
        `[jobit] ingesta: ${written.count} ofertas (antes ${written.previous_count})` +
          ` scrapeadas ${written.scraped_at || "sin fecha"}`,
      );
      return written;
    },
    { parse: "arrayBuffer" },
  );
