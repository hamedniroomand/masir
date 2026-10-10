import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';

// h3's getRequestIP takes the LEFTMOST X-Forwarded-For entry. Proxies append,
// so the leftmost entry is whatever the caller sent. Reading it means a caller
// picks their own rate-limit bucket by setting one header.
//
// Count from the right instead. With `depth` trusted proxies in front, the
// entry at position `depth` from the end is the one the outermost trusted proxy
// wrote, and nothing further left can be trusted.
export function clientIp(event: H3Event, trustedProxyDepth: number): string {
  const socket = event.node.req.socket.remoteAddress ?? 'unknown';
  if (trustedProxyDepth < 1)
    return socket;

  const chain = getRequestHeader(event, 'x-forwarded-for')?.split(',').map(part => part.trim()).filter(Boolean);
  if (!chain?.length)
    return socket;

  // A chain shorter than the trusted depth means the request did not pass
  // through every proxy. Fall back rather than read a caller-supplied entry.
  return chain[chain.length - trustedProxyDepth] ?? socket;
}
