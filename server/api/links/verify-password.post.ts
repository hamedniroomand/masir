import * as v from 'valibot';
import { recordEvent } from '#server/utils/analytics';
import { writeAuditEvent } from '#server/utils/audit-log';
import { readValidBody } from '#server/utils/body';
import { findLinkBySlug } from '#server/utils/link-repo';
import { verifySecret } from '#server/utils/password';
import { setPasswordGrant } from '#server/utils/password-grant';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { parseRequestMeta } from '#server/utils/request-meta';
import { deriveLinkStatus } from '#shared/link-status';

const bodySchema = v.object({
  slug: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(1)),
  requestedPath: v.optional(v.string()),
});

export default defineEventHandler(async (event) => {
  // This route is public. The workspace comes from the hostname, never from
  // the caller, or a password for one workspace could unlock another.
  const workspace = event.context.workspace as { id: string; linkPrefix?: string | null } | undefined;
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);
  const config = useRuntimeConfig();
  const clientKey = await hashClientKey(event);
  const limit = Number(config.rateLimitPasswordPerMinute) || 10;
  const rl = await rateLimitCheck(`pwd:${workspace.id}:${body.slug}:${clientKey}`, limit, 60_000);
  if (!rl.ok) {
    await writeAuditEvent('rate_limit_exceeded', { scope: 'password' }, { workspaceId: workspace.id });
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const link = await findLinkBySlug(workspace.id, body.slug);
  if (!link?.passwordHash) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    clickCount: link.clickCount,
  });
  if (status !== 'active') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const ok = await verifySecret(body.password, link.passwordHash);
  if (!ok) {
    const meta = parseRequestMeta(event);
    await recordEvent(workspace.id, link.id, meta, 'password_failed').catch(() => {});
    throw createError({
      statusCode: 401,
      statusMessage: 'Incorrect password.',
      data: { reason: 'Incorrect password.' },
    });
  }

  setPasswordGrant(event, workspace.id, link.slug, config.sessionPassword);
  const redirectTo = body.requestedPath && body.requestedPath.startsWith('/')
    ? body.requestedPath
    : (workspace.linkPrefix ? `/${workspace.linkPrefix}/${link.slug}` : `/${link.slug}`);
  return { ok: true, redirectTo };
});
