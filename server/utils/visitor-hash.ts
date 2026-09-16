import type { H3Event } from 'h3';
import { createHash } from 'node:crypto';
import { getRequestHeaders, getRequestIP } from 'h3';

// ponytail: shared IP merges visitors; upgrade path is none — deliberate privacy trade
export function dailyVisitorSalt() {
  return String(Math.floor(Date.now() / 86_400_000));
}

export async function visitorHashForLink(event: H3Event, linkId: string): Promise<string> {
  const salt = dailyVisitorSalt();
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const ua = getRequestHeaders(event)['user-agent'] ?? '';
  return createHash('sha256')
    .update(`${salt}:${linkId}:${ip}:${ua}`)
    .digest('hex')
    .slice(0, 32);
}
