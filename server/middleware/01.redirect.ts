import type { H3Event } from 'h3';
import type { ResolvedLink } from '#server/database/schema';
import type { RequestMeta } from '#server/utils/request-meta';
import type { OutcomeLabel } from '#shared/codes';
import { setResponseHeader } from 'h3';
import { recordEvent } from '#server/utils/analytics';
import { getCachedLink, setCachedLink } from '#server/utils/link-cache';
import { consumeVisit, findLinkBySlug } from '#server/utils/link-repo';
import { hasValidPasswordGrant } from '#server/utils/password-grant';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { parseRequestMeta } from '#server/utils/request-meta';
import { visitorHashForLink } from '#server/utils/visitor-hash';

import { deriveLinkStatus } from '#shared/link-status';
import { RESERVED_SLUGS } from '#shared/slug';
import { buildDestination, utmParamsFor } from '#shared/utm';

function logLinkEvent(event: H3Event, workspaceId: string, linkId: string, outcome: OutcomeLabel, meta: RequestMeta) {
  const visitorHash = !meta.isBot && outcome === 'redirect_success'
    ? visitorHashForLink(event, linkId)
    : null;
  event.waitUntil(recordEvent(workspaceId, linkId, meta, outcome, visitorHash).catch(() => {}));
}

// Both the derived status and a lost race with consumeVisit end here. A
// fallback never counts as a click and never uses a visit.
async function sendLimitFallback(event: H3Event, workspaceId: string, link: ResolvedLink, meta: RequestMeta) {
  if (link.limitDestination) {
    logLinkEvent(event, workspaceId, link.id, 'limit_redirect', meta);
    await sendRedirect(event, link.limitDestination, 302);
    return;
  }
  logLinkEvent(event, workspaceId, link.id, 'limit_reached', meta);
  throw createError({ statusCode: 404, statusMessage: 'Link unavailable', data: { linkState: 'limit_reached' } });
}

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
  // Nuxt and Nitro internals start with an underscore (/_nuxt, /__nuxt_error).
  if (!segment || segment.includes('.') || segment.includes('/') || segment.startsWith('_'))
    return;
  if (RESERVED_SLUGS.has(segment))
    return;

  // Short links live only inside a workspace. The root host serves none, and
  // without SSR the Vue app cannot answer 404 itself, so the server does.
  const workspace = event.context.workspace as { id: string } | undefined;
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: 'Link not found' });

  const config = useRuntimeConfig();
  const clientKey = await hashClientKey(event);
  const redirectLimit = Number(config.rateLimitRedirectPerMinute) || 120;
  const limit = await rateLimitCheck(`redirect:${clientKey}`, redirectLimit, 60_000, 'allow');
  if (!limit.ok) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  let link = getCachedLink(workspace.id, segment);
  if (link === undefined) {
    const resolved = await findLinkBySlug(workspace.id, segment);
    link = resolved;
    setCachedLink(workspace.id, segment, resolved);
  }

  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Link not found' });

  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    clickCount: link.clickCount,
  });

  // Set once above every branch rather than on each path that reaches a
  // redirect. Nitro's error handler replaces Cache-Control with no-cache on a
  // thrown 404, so a blocked link answers with that instead; no-cache still
  // forces revalidation, and the body is a generic error page.
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const meta = parseRequestMeta(event);

  if (status === 'disabled') {
    logLinkEvent(event, workspace.id, link.id, 'disabled_block', meta);
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable', data: { linkState: 'disabled' } });
  }
  if (status === 'expired') {
    if (link.expirationDestination) {
      logLinkEvent(event, workspace.id, link.id, 'expired_redirect', meta);
      await sendRedirect(event, link.expirationDestination, 302);
      return;
    }
    logLinkEvent(event, workspace.id, link.id, 'expired_block', meta);
    throw createError({ statusCode: 404, statusMessage: 'Link expired', data: { linkState: 'expired' } });
  }
  if (status === 'limit_reached') {
    await sendLimitFallback(event, workspace.id, link, meta);
    return;
  }
  if (status === 'scheduled') {
    if (link.scheduledDestination) {
      logLinkEvent(event, workspace.id, link.id, 'scheduled_redirect', meta);
      await sendRedirect(event, link.scheduledDestination, 302);
      return;
    }
    logLinkEvent(event, workspace.id, link.id, 'scheduled_block', meta);
    throw createError({
      statusCode: 404,
      statusMessage: 'Link unavailable',
      data: { linkState: 'scheduled', startsAt: link.startsAt?.toISOString() ?? null },
    });
  }

  if (link.passwordHash) {
    const granted = hasValidPasswordGrant(event, workspace.id, segment, config.sessionPassword);
    if (!granted) {
      await sendRedirect(event, `/p/${segment}`, 302);
      return;
    }
  }

  if (meta.isBot) {
    logLinkEvent(event, workspace.id, link.id, 'bot_request', meta);
  }
  else {
    const consumed = await consumeVisit(link.id);
    if (!consumed) {
      // A visit between the status check above and this statement used the last
      // one, so the fallback applies here too.
      await sendLimitFallback(event, workspace.id, link, meta);
      return;
    }
    logLinkEvent(event, workspace.id, link.id, 'redirect_success', meta);
  }

  const destination = buildDestination(link.destinationUrl, utmParamsFor(link), inboundQuery);
  await sendRedirect(event, destination, 302);
});
