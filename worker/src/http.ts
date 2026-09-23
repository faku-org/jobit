/** BuscoJobs answers 403 to the old bot UA from a VPS. A browser UA is
 * enough from some networks; the datacenter IP may still be blocked. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Salida por proxy.
 *
 * El VPS tiene IP de datacenter y BuscoJobs le contesta 403, así que el scrapeo
 * que corre ahí sale por el egress de una máquina con IP limpia
 * (`worker/src/egress.ts`, corriendo en la PC). Si no hay proxy, va directo: en
 * desarrollo y en la propia máquina de casa no hace falta.
 *
 * El valor es una URL `http://[usuario:clave@]host:puerto`: Bun la acepta tal
 * cual, así que un proxy residencial pago es cambiar esta variable y nada más.
 */
const PROXY = (process.env.JOBIT_SCRAPE_PROXY ?? "").trim();

/** Bun extiende RequestInit con `proxy`; el tipo base no lo conoce. */
const proxyOption = (): { proxy?: string } => (PROXY ? { proxy: PROXY } : {});

/** Para el log, sin la credencial si el proxy la lleva en la URL. */
export const proxyDescription = (): string =>
  PROXY ? `proxy ${PROXY.replace(/\/\/[^@/]*@/, "//***@")}` : "directo";

interface RequestOptions {
  retries?: number;
  timeoutMs?: number;
  accept?: string;
  /** Sent as a JSON POST body; without it the request is a GET. */
  body?: unknown;
}

const lastRequestAt = new Map<string, number>();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Throttles per host so a run never hammers a source. */
async function throttle(url: string, delayMs: number): Promise<void> {
  const host = new URL(url).host;
  const elapsed = Date.now() - (lastRequestAt.get(host) ?? 0);
  if (elapsed < delayMs) await sleep(delayMs - elapsed);
  lastRequestAt.set(host, Date.now());
}

async function request(
  url: string,
  delayMs: number,
  options: RequestOptions,
): Promise<Response | null> {
  const { retries = 2, timeoutMs = 20_000, accept = "application/json", body } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(url, delayMs);
    try {
      const response = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "es-UY,es;q=0.9",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        ...proxyOption(),
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (cause) {
      if (attempt === retries) {
        console.warn(`  ! ${url} failed: ${String(cause)}`);
        return null;
      }
      await sleep(delayMs * (attempt + 2));
    }
  }

  return null;
}

export async function fetchJson<T>(
  url: string,
  delayMs: number,
  options: RequestOptions = {},
): Promise<T | null> {
  const response = await request(url, delayMs, options);
  if (!response) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchText(
  url: string,
  delayMs: number,
  options: RequestOptions = {},
): Promise<string | null> {
  const response = await request(url, delayMs, { accept: "text/html,*/*", ...options });
  return response ? await response.text() : null;
}
