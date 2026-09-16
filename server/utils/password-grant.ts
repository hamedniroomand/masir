import type { H3Event } from 'h3';
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie } from 'h3';

const COOKIE = 'ly_pwd_grant';

function sign(slug: string, exp: number, secret: string) {
  return createHmac('sha256', secret).update(`${slug}:${exp}`).digest('base64url');
}

export function setPasswordGrant(event: H3Event, slug: string, secret: string, ttlSec = 900) {
  const exp = Date.now() + ttlSec * 1000;
  const sig = sign(slug, exp, secret);
  setCookie(event, COOKIE, `${slug}.${exp}.${sig}`, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ttlSec,
    path: '/',
  });
}

export function hasValidPasswordGrant(event: H3Event, slug: string, secret: string): boolean {
  const raw = getCookie(event, COOKIE);
  if (!raw)
    return false;
  const parts = raw.split('.');
  if (parts.length < 3)
    return false;
  const sig = parts.pop()!;
  const expStr = parts.pop()!;
  const storedSlug = parts.join('.');
  if (storedSlug !== slug)
    return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp)
    return false;
  const expected = sign(slug, exp, secret);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }
  catch {
    return false;
  }
}
