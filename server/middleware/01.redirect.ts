import type { H3Event } from 'h3';
import type { EventAttribution } from '#server/utils/analytics';
import type { RequestMeta } from '#server/utils/request-meta';
import type { OutcomeLabel } from '#shared/codes';
import { setResponseHeader } from 'h3';
import { recordEvent, reportEventWriteFailure } from '#server/utils/analytics';
import { meetsCapThreshold, sendCapAlert } from '#server/utils/link-alerts';
import { getCachedLink, setCachedLink } from '#server/utils/link-cache';
import { consumeVisit, findLinkBySlug } from '#server/utils/link-repo';
import { hasValidPasswordGrant } from '#server/utils/password-grant';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { parseRequestMeta } from '#server/utils/request-meta';

import { visitorHashForLink } from '#server/utils/visitor-hash';
import { decideLimitFallback, decideRedirect } from '#shared/redirect-decision';
import { RESERVED_SLUGS } from '#shared/slug';
import { applyUtm, utmParamsFor } from '#shared/utm';

function logLinkEvent(
  event: H3Event,
  workspaceId: string,
  linkId: string,
  outcome: OutcomeLabel,
  meta: RequestMeta,
  attribution?: EventAttribution | null,
) {
  const visitorHash = !meta.isBot && outcome === 'redirect_success'
    ? visitorHashForLink(event, linkId)
    : null;
  event.waitUntil(recordEvent(workspaceId, linkId, meta, outcome, visitorHash, attribution).catch(reportEventWriteFailure));
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

  const segments = pathname.replace(/^\//, '').split('/');
  const [first] = segments;
  // Nuxt and Nitro internals start with an underscore (/_nuxt, /__nuxt_error).
  if (!first || first.includes('.') || first.startsWith('_'))
    return;
  if (RESERVED_SLUGS.has(first))
    return;

  // Short links live only inside a workspace. The root host serves none, and
  // without SSR the Vue app cannot answer 404 itself, so the server does.
  const workspace = event.context.workspace as {
    id: string;
    linkPrefix: string | null;
    retainedPrefixes?: Set<string>;
  } | undefined;
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: 'Link not found' });

  const retained = workspace.retainedPrefixes ?? new Set<string>();

  // With a prefix the slug is the second segment and the root paths stay
  // with the app. Without one, only a single segment is a slug.
  let segment: string | undefined;
  if (segments.length === 2) {
    if (first === workspace.linkPrefix || retained.has(first)) {
      segment = segments[1];
    }
  }
  else if (segments.length === 1) {
    if (!workspace.linkPrefix || retained.has('')) {
      segment = first;
    }
  }

  if (!segment)
    return;

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

  // Set once above every branch rather than on each path that reaches a
  // redirect. Nitro's error handler replaces Cache-Control with no-cache on a
  // thrown 404, so a blocked link answers with that instead; no-cache still
  // forces revalidation, and the body is a generic error page.
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const meta = parseRequestMeta(event);
  const hasPasswordGrant = Boolean(link.passwordHash)
    && hasValidPasswordGrant(event, workspace.id, segment, config.sessionPassword);

  let decision = decideRedirect(link, { meta, now: Date.now(), hasPasswordGrant });

  if (decision.kind === 'password') {
    await sendRedirect(event, `/p/${segment}?path=${encodeURIComponent(pathname)}`, 302);
    return;
  }

  if (decision.kind === 'block') {
    logLinkEvent(event, workspace.id, link.id, decision.outcome, meta);
    throw createError({
      statusCode: decision.statusCode,
      statusMessage: decision.outcome === 'expired_block' ? 'Link expired' : 'Link unavailable',
      data: { linkState: decision.linkState, ...(decision.startsAt != null && { startsAt: decision.startsAt }) },
    });
  }

  if (decision.consumesVisit) {
    const consumed = await consumeVisit(link.id);
    if (consumed == null) {
      decision = decideLimitFallback(link);
      if (decision.kind === 'block') {
        logLinkEvent(event, workspace.id, link.id, decision.outcome, meta);
        throw createError({
          statusCode: decision.statusCode,
          statusMessage: 'Link unavailable',
          data: { linkState: decision.linkState },
        });
      }
    }
    else {
      // The cached row says whether the alert went out already, so the claim
      // statement runs once per cache lifetime, not on every click past the line.
      if (link.capAlertSentAt == null && meetsCapThreshold(consumed, link.maximumVisits))
        event.waitUntil(sendCapAlert(link.id).catch(() => {}));
    }
  }

  const needsUtm = decision.rule === 'default' || decision.rule === 'country' || decision.rule === 'os';
  const { url: destination, effective } = needsUtm
    ? applyUtm(decision.destination, utmParamsFor(link), inboundQuery)
    : { url: decision.destination, effective: null };

  const isSuccessOrBot = decision.outcome === 'redirect_success' || decision.outcome === 'bot_request';
  const attribution: EventAttribution | null = isSuccessOrBot
    ? {
        campaignId: link.campaignId,
        utmSource: effective?.utm_source,
        utmMedium: effective?.utm_medium,
        utmCampaign: effective?.utm_campaign,
        utmContent: effective?.utm_content,
      }
    : null;

  logLinkEvent(event, workspace.id, link.id, decision.outcome, meta, attribution);
  await sendRedirect(event, destination, 302);
});
