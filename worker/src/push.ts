import { resolve } from "node:path";

/**
 * Sube `output/jobs.json` a la API.
 *
 * El scrapeo dejó de poder correr en el servidor: BuscoJobs contesta 403 a la
 * IP del VPS. Corre entonces en una máquina común, y este script es cómo lo que
 * produce llega a producción. La contracara está en `api/src/ingest.ts`.
 */
const OUTPUT_PATH = resolve(import.meta.dir, "../output/jobs.json");

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

const mb = (bytes: number): string => (bytes / 1_000_000).toFixed(1);

async function send(url: string, token: string, body: Uint8Array): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
      },
      body,
    });
  } catch (cause) {
    return die(`no se pudo llegar a la API: ${String(cause)}`);
  }
}

async function push(): Promise<void> {
  const url = (process.env.JOBIT_INGEST_URL ?? "").trim();
  const token = (process.env.JOBIT_INGEST_TOKEN ?? "").trim();

  if (!url || !token) {
    die(
      "faltan JOBIT_INGEST_URL y/o JOBIT_INGEST_TOKEN.\n" +
        "Copiá worker/.env.example a worker/.env y completalos.",
    );
  }

  const file = Bun.file(OUTPUT_PATH);
  if (!(await file.exists())) {
    die(`no hay nada para subir: falta ${OUTPUT_PATH}\nCorré antes: bun run scrape`);
  }

  /** Cinco megas de JSON se van a medio comprimidos, y la subida de una
   * conexión hogareña es la mitad lenta. La API reconoce las dos formas. */
  const raw = await file.bytes();
  const body = Bun.gzipSync(raw);

  console.log(`subiendo ${mb(raw.length)} MB (${mb(body.length)} MB comprimidos) a ${url}`);

  const response = await send(url, token, body);
  const text = await response.text();
  if (!response.ok) die(`la API contestó ${response.status}: ${text}`);

  console.log(`listo: ${text}`);
}

await push();
