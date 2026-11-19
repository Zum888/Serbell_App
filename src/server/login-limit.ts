const FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

type Bucket = { failures: number; windowStart: number; lockedUntil: number };

const buckets = new Map<string, Bucket>();
const GLOBAL_FAILURES = 30;
let globalFailures = 0;
let globalWindow = 0;

export function resetLoginLimits() {
  buckets.clear();
  globalFailures = 0;
  globalWindow = 0;
}

/** The address the closest proxy added. Missing headers do not collapse every caller into one bucket. */
export function clientAddress(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts.at(-1);
    if (last) return last.slice(0, 80);
  }
  return null;
}

function gateCookie(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(/(?:^|;\s*)sb_gate=([a-f0-9]{32})(?:;|$)/);
  return match?.[1] ?? null;
}

/** One bucket per address, or per browser cookie when the address is missing. Never a shared "unknown". */
export function loginBucketKey(request: Request): string | null {
  const address = clientAddress(request);
  if (address) return `ip:${address}`;
  const gate = gateCookie(request);
  if (gate) return `gate:${gate}`;
  return null;
}

export function globalLoginAllowed(now = Date.now()): boolean {
  if (now - globalWindow > WINDOW_MS) return true;
  return globalFailures < GLOBAL_FAILURES;
}

export function loginAllowed(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return true;
  if (bucket.lockedUntil > now) return false;
  if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  return true;
}

export function noteLoginFailure(key: string, now = Date.now()) {
  const current = buckets.get(key);
  const bucket = !current || now - current.windowStart > WINDOW_MS
    ? { failures: 0, windowStart: now, lockedUntil: 0 }
    : current;
  if (now - globalWindow > WINDOW_MS) {
    globalWindow = now;
    globalFailures = 0;
  }
  globalFailures += 1;
  bucket.failures += 1;
  if (bucket.failures >= FAILURES) {
    bucket.lockedUntil = now + WINDOW_MS;
    bucket.failures = 0;
    bucket.windowStart = now;
  }
  buckets.set(key, bucket);
}

export function clearLoginFailures(key: string) {
  buckets.delete(key);
}
