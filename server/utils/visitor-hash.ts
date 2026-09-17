import type { H3Event } from 'h3';
import { getRequestHeaders, getRequestIP } from 'h3';

// The day number is public. Without a secret, an attacker can try each IP address
// and find the visitor. The IP space is small enough to search.
export function dailyVisitorSalt(secret: string) {
  return `${secret}:${Math.floor(Date.now() / 86_400_000)}`;
}

// ponytail: shared IP merges visitors; upgrade path is none — deliberate privacy trade
export function visitorHashForLink(event: H3Event, linkId: string): string {
  const { sessionPassword } = useRuntimeConfig();
  const salt = dailyVisitorSalt(sessionPassword);
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const ua = getRequestHeaders(event)['user-agent'] ?? '';
  return new Bun.CryptoHasher('sha256')
    .update(`${salt}:${linkId}:${ip}:${ua}`)
    .digest('hex')
    .slice(0, 32);
}
