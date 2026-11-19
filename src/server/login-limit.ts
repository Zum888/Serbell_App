const FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

type Bucket = { failures: number; windowStart: number; lockedUntil: number };

const buckets = new Map<string, Bucket>();

export function resetLoginLimits() {
  buckets.clear();
}

/** The address the closest proxy added, so a caller cannot pick a fresh bucket by editing the header. */
export function clientAddress(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts.at(-1);
    if (last) return last.slice(0, 80);
  }
  return "unknown";
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
