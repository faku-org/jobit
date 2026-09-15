/**
 * A fixed window per client, held in memory.
 *
 * This is one small service on one box, so a shared store would be
 * infrastructure for a problem it does not have. What it stops is the one
 * endpoint that writes to disk being asked to write forever, and a flood of
 * reads pinning the box while it scans the board.
 */
export interface Limit {
  windowMs: number;
  /** Requests allowed inside one window. */
  max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** The table itself must not become the way to exhaust the box. */
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

/** Drops the windows that already closed, and then, if that was not enough,
 * the oldest ones: insertion order tracks age closely enough here. */
function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size < MAX_BUCKETS) return;

  const excess = buckets.size - MAX_BUCKETS + 1;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++removed >= excess) break;
  }
}

export interface Allowance {
  ok: boolean;
  /** Whole seconds until the window resets, for Retry-After. */
  retryAfter: number;
}

const ALLOWED: Allowance = { ok: true, retryAfter: 0 };

export function take(key: string, limit: Limit, now: number = Date.now()): Allowance {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) prune(now);
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return ALLOWED;
  }

  bucket.count += 1;
  if (bucket.count <= limit.max) return ALLOWED;

  return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

/** Only the tests need this: the windows expire on their own. */
export function resetLimits(): void {
  buckets.clear();
}

/**
 * Quién está preguntando.
 *
 * Detrás de nginx la dirección del socket es siempre el proxy, así que hace
 * falta una cabecera. La que sirve es `x-real-ip`: nginx la escribe con
 * `$remote_addr`, que es el peer de la conexión, y la pisa venga como venga
 * de afuera.
 *
 * `x-forwarded-for` no se mira, y no es un olvido. nginx la arma con
 * `$proxy_add_x_forwarded_for`, que AGREGA el peer a lo que el cliente haya
 * mandado: la cabecera entera menos el último salto es texto del cliente.
 * Leerla, con cualquier criterio, es dejar que cualquiera se invente una
 * dirección nueva por petición y no tenga límite ninguno. Como `x-real-ip` ya
 * dice lo mismo sin esa parte, la otra sobra.
 *
 * Si no hay `x-real-ip` es porque no hay proxy adelante, y entonces la
 * dirección del socket es la verdad. Si tampoco hay, todo cae en un balde
 * compartido: de más se limita, que es el lado correcto para equivocarse.
 *
 * Las cabeceras se creen porque el servicio escucha en localhost: nadie llega
 * sin pasar por el proxy que las escribe. Si algún día HOST se pone en
 * 0.0.0.0, esto deja de ser cierto y hay que revisarlo.
 */
export function clientKey(request: Request, address: string | null): string {
  return request.headers.get("x-real-ip")?.trim() || address || "unknown";
}
