import type { H3Event } from 'h3';
import { getRequestHeaders } from 'h3';
import { clientIp } from '#server/utils/client-ip';

// The day number is public. Without a secret, an attacker can try each IP address
// and find the visitor. The IP space is small enough to search.
export function dailyVisitorSalt(secret: string) {
  return `${secret}:${Math.floor(Date.now() / 86_400_000)}`;
}

// ponytail: shared IP merges visitors; upgrade path is none — deliberate privacy trade
export function visitorHashForLink(event: H3Event, linkId: string): string {
  const { sessionPassword, visitorHashSecret, trustedProxyDepth } = useRuntimeConfig();
  // Its own secret, so rotating one does not change the other. The session
  // password is the fallback, which keeps an existing deployment working.
  const salt = dailyVisitorSalt(visitorHashSecret || sessionPassword);
  // A caller who picks their own address counts as a new visitor on every hit.
  const ip = clientIp(event, Number(trustedProxyDepth) || 0);
  const ua = getRequestHeaders(event)['user-agent'] ?? '';
  return new Bun.CryptoHasher('sha256')
    .update(`${salt}:${linkId}:${ip}:${ua}`)
    .digest('hex')
    .slice(0, 32);
}
