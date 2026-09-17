import { resolveRateLimitStore } from '#server/utils/rate-limit-store';

const salt = crypto.randomUUID();

export function rateLimitSalt() {
  return salt;
}

export async function rateLimitCheck(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const { count, resetAt } = await resolveRateLimitStore().hit(key, windowMs);
  if (count > limit)
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) };
  return { ok: true };
}

// The signature stays async because every caller awaits it.
export async function hashClientKey(event: import('h3').H3Event): Promise<string> {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  return new Bun.CryptoHasher('sha256').update(`${salt}:${ip}`).digest('hex');
}
