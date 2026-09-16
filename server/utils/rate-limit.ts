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

export async function hashClientKey(event: import('h3').H3Event): Promise<string> {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
