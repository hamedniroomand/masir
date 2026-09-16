import * as v from 'valibot';
import { recordEvent } from '#server/utils/analytics';
import { findLinkBySlug } from '#server/utils/link-repo';
import { setPasswordGrant } from '#server/utils/password-grant';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { parseRequestMeta } from '#server/utils/request-meta';
import { writeSecurityEvent } from '#server/utils/security-log';
import { deriveLinkStatus } from '#shared/link-status';

const bodySchema = v.object({
  slug: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(1)),
});

export default defineEventHandler(async (event) => {
  const body = v.parse(bodySchema, await readBody(event));
  const config = useRuntimeConfig();
  const clientKey = await hashClientKey(event);
  const limit = Number(config.rateLimitPasswordPerMinute) || 10;
  // ponytail: in-memory limiter, one node only; upgrade path is a shared store
  const rl = await rateLimitCheck(`pwd:${body.slug}:${clientKey}`, limit, 60_000);
  if (!rl.ok) {
    await writeSecurityEvent('rate_limit_exceeded', { scope: 'password' });
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const link = await findLinkBySlug(body.slug);
  if (!link?.passwordHash) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    successfulVisitCount: link.successfulVisitCount,
  });
  if (status !== 'active') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const ok = await verifyPassword(link.passwordHash, body.password);
  if (!ok) {
    const meta = parseRequestMeta(event);
    await recordEvent(link.id, meta, 'password_failed').catch(() => {});
    throw createError({
      statusCode: 401,
      statusMessage: 'Incorrect password.',
      data: { reason: 'Incorrect password.' },
    });
  }

  setPasswordGrant(event, link.slug, config.sessionPassword);
  return { ok: true, redirectTo: `/${link.slug}` };
});
