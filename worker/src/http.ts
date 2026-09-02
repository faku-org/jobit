const USER_AGENT = "jobit/0.1 (personal job-search tool)";

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
