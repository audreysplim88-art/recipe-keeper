/**
 * Simple in-memory per-user rate limiter.
 *
 * Uses a module-level Map so the store persists across requests within
 * the same server instance. It resets on redeploy and doesn't coordinate
 * across multiple Vercel instances — upgrade to Upstash Redis when needed.
 *
 * Usage:
 *   if (!checkRateLimit(user.id, 30, 10 * 60 * 1000)) {
 *     return Response.json({ error: "Too many requests…" }, { status: 429 });
 *   }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request should be allowed, false if rate-limited.
 *
 * @param key      Unique identifier (e.g. `${userId}:${route}`)
 * @param limit    Max requests allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

// Periodically evict expired entries to prevent unbounded memory growth.
// Runs every 15 minutes.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 15 * 60 * 1000);
}
