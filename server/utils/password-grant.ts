import type { H3Event } from 'h3';
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie } from 'h3';

// Use one cookie for each slug. A single shared cookie loses the grant
// when the visitor unlocks a different link.
function cookieName(slug: string) {
  return `ly_pwd_${slug}`;
}

function sign(slug: string, exp: number, secret: string) {
  return createHmac('sha256', secret).update(`${slug}:${exp}`).digest('base64url');
}

export function setPasswordGrant(event: H3Event, slug: string, secret: string, ttlSec = 900) {
  const exp = Date.now() + ttlSec * 1000;
  setCookie(event, cookieName(slug), `${exp}.${sign(slug, exp, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ttlSec,
    path: '/',
  });
}

export function hasValidPasswordGrant(event: H3Event, slug: string, secret: string): boolean {
  const raw = getCookie(event, cookieName(slug));
  if (!raw)
    return false;
  const [expStr, sig] = raw.split('.');
  if (!expStr || !sig)
    return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp)
    return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(sign(slug, exp, secret)));
  }
  catch {
    return false;
  }
}
