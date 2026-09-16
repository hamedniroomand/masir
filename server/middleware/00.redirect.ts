import { setResponseHeader } from 'h3';
import { recordClick } from '#server/utils/analytics';
import { getCachedLink, setCachedLink } from '#server/utils/link-cache';
import { consumeVisit, findLinkBySlug } from '#server/utils/link-repo';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { parseRequestMeta } from '#server/utils/request-meta';

import { deriveLinkStatus } from '#shared/link-status';
import { RESERVED_SLUGS } from '#shared/slug';
import { buildDestination, utmParamsFor } from '#shared/utm';

export default defineEventHandler(async (event) => {
  const method = event.method;
  if (method !== 'GET' && method !== 'HEAD')
    return;

  const path = event.path;
  if (!path || path === '/')
    return;

  const queryStart = path.indexOf('?');
  const pathname = queryStart === -1 ? path : path.slice(0, queryStart);
  const inboundQuery = queryStart === -1 ? '' : path.slice(queryStart + 1);

  const segment = pathname.replace(/^\//, '').split('/')[0];
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
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    successfulVisitCount: link.successfulVisitCount,
  });

  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');

  if (status === 'disabled') {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable', data: { linkState: 'disabled' } });
  }
  if (status === 'expired') {
    if (link.expirationDestination) {
      setResponseHeader(event, 'Cache-Control', 'private, no-store');
      await sendRedirect(event, link.expirationDestination, 302);
      return;
    }
    throw createError({ statusCode: 404, statusMessage: 'Link expired', data: { linkState: 'expired' } });
  }
  if (status === 'limit_reached') {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable', data: { linkState: 'limit_reached' } });
  }
  if (status === 'scheduled') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link unavailable',
      data: { linkState: 'scheduled', startsAt: link.startsAt?.toISOString() ?? null },
    });
  }

  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const meta = parseRequestMeta(event);

  if (!meta.isBot) {
    const consumed = await consumeVisit(link.id);
    if (!consumed) {
      throw createError({ statusCode: 404, statusMessage: 'Link unavailable', data: { linkState: 'limit_reached' } });
    }
    event.waitUntil(recordClick(link.id, meta).catch(() => {}));
  }

  const destination = buildDestination(link.destinationUrl, utmParamsFor(link), inboundQuery);
  await sendRedirect(event, destination, 302);
});
