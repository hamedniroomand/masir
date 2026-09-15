import { setResponseHeader } from 'h3';
import { deriveLinkStatus } from '../../shared/link-status';
import { recordClick } from '../utils/analytics';
import { getCachedLink, setCachedLink } from '../utils/link-cache';
import { findLinkBySlug } from '../utils/link-repo';
import { hashClientKey, rateLimitCheck } from '../utils/rate-limit';
import { parseRequestMeta } from '../utils/request-meta';
import { RESERVED_SLUGS } from '../utils/slug';

export default defineEventHandler(async (event) => {
  const method = event.method;
  if (method !== 'GET' && method !== 'HEAD')
    return;

  const path = event.path;
  if (!path || path === '/')
    return;

  const segment = path.replace(/^\//, '').split('/')[0];
  if (!segment || segment.includes('.') || segment.includes('/'))
    return;
  if (RESERVED_SLUGS.has(segment))
    return;

  const config = useRuntimeConfig();
  const clientKey = await hashClientKey(event);
  const redirectLimit = Number(config.rateLimitRedirectPerMinute) || 120;
  const limit = rateLimitCheck(`redirect:${clientKey}`, redirectLimit, 60_000);
  if (!limit.ok) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  let link = getCachedLink(segment);
  if (link === undefined) {
    const resolved = await findLinkBySlug(segment);
    link = resolved;
    setCachedLink(segment, resolved);
  }

  if (!link)
    return;

  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
  });

  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');

  if (status === 'disabled') {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable', data: { linkState: 'disabled' } });
  }
  if (status === 'expired') {
    throw createError({ statusCode: 404, statusMessage: 'Link expired', data: { linkState: 'expired' } });
  }

  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const meta = parseRequestMeta(event);
  event.waitUntil(recordClick(link.id, meta).catch(() => {}));

  await sendRedirect(event, link.destinationUrl, 302);
});
