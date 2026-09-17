import type { H3Event } from 'h3';
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie } from 'h3';

// Use one cookie for each link. A single shared cookie loses the grant when the
// visitor unlocks a different link. The name and the signature both carry the
// workspace: two workspaces may hold the same slug, and a grant for one must
// never unlock the other.
function cookieName(workspaceId: string, slug: string) {
  return `ly_pwd_${workspaceId}_${slug}`;
}

function sign(workspaceId: string, slug: string, exp: number, secret: string) {
  return createHmac('sha256', secret).update(`${workspaceId}:${slug}:${exp}`).digest('base64url');
}

export function setPasswordGrant(event: H3Event, workspaceId: string, slug: string, secret: string, ttlSec = 900) {
  const exp = Date.now() + ttlSec * 1000;
  setCookie(event, cookieName(workspaceId, slug), `${exp}.${sign(workspaceId, slug, exp, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ttlSec,
    path: '/',
  });
}

export function hasValidPasswordGrant(event: H3Event, workspaceId: string, slug: string, secret: string): boolean {
  const raw = getCookie(event, cookieName(workspaceId, slug));
  if (!raw)
    return false;
  const [expStr, sig] = raw.split('.');
  if (!expStr || !sig)
    return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp)
    return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(sign(workspaceId, slug, exp, secret)));
  }
  catch {
    return false;
  }
}
