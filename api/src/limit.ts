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
 * Who is asking. Behind nginx the socket address is always the proxy, so the
 * forwarded header is the only thing separating one visitor from another. That
 * header is trusted precisely because the service binds to localhost in
 * production: nobody reaches it without going through the proxy that sets it.
 */
export function clientKey(request: Request, address: string | null): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || address || "unknown";
}
