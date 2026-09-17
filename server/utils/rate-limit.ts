import { clientIp } from '#server/utils/client-ip';
import { resolveRateLimitStore } from '#server/utils/rate-limit-store';

const salt = crypto.randomUUID();

export function rateLimitSalt() {
  return salt;
}

type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSec: number };

// A shared store can be unreachable. The redirect path keeps serving, because a
// store outage must not take the shortener down. Everything else refuses, so an
// outage cannot quietly disable brute-force protection.
export async function rateLimitCheck(
  key: string,
  limit: number,
  windowMs: number,
  onStoreError: 'deny' | 'allow' = 'deny',
): Promise<RateLimitVerdict> {
  let hit;
  try {
    hit = await resolveRateLimitStore().hit(key, windowMs);
  }
  catch (error) {
    console.error('[rate-limit] store unreachable', error);
    return onStoreError === 'allow' ? { ok: true } : { ok: false, retryAfterSec: 1 };
  }

  if (hit.count > limit)
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000)) };
  return { ok: true };
}

// The signature stays async because every caller awaits it.
export async function hashClientKey(event: import('h3').H3Event): Promise<string> {
  const { trustedProxyDepth } = useRuntimeConfig();
  const ip = clientIp(event, Number(trustedProxyDepth) || 0);
  return new Bun.CryptoHasher('sha256').update(`${salt}:${ip}`).digest('hex');
}
