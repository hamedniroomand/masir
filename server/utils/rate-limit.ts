interface Entry { count: number; resetAt: number }

const buckets = new Map<string, Entry>();
const salt = crypto.randomUUID();

export function rateLimitSalt() {
  return salt;
}

export function rateLimitCheck(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  evict(now);

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  entry.count++;
  return { ok: true };
}

function evict(now: number) {
  if (buckets.size < 10_000)
    return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now)
      buckets.delete(key);
  }
}

export async function hashClientKey(event: import('h3').H3Event): Promise<string> {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
