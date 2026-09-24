import * as v from 'valibot';
import { requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findLinkById } from '#server/utils/link-repo';
import { decideRedirect } from '#shared/redirect-decision';

const bodySchema = v.object({
  country: v.optional(v.nullable(v.pipe(
    v.string(),
    v.trim(),
    v.check(value => value === '' || /^[a-z]{2}$/i.test(value), 'Country must be two letters.'),
  ))),
  os: v.optional(v.picklist(['ios', 'android', 'desktop', 'other'] as const)),
  at: v.optional(v.nullable(v.string())),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);

  let now = Date.now();
  if (body.at) {
    const parsed = Date.parse(body.at);
    if (!Number.isFinite(parsed))
      throw createError({ statusCode: 422, statusMessage: 'Use an ISO 8601 date with an offset or Z.', data: { reason: 'Use an ISO 8601 date with an offset or Z.' } });
    now = parsed;
  }

  const countryRaw = body.country?.trim() ?? '';
  const decision = decideRedirect(link, {
    meta: {
      os: body.os ?? 'desktop',
      country: countryRaw ? countryRaw.toUpperCase() : null,
      isBot: false,
    },
    now,
    hasPasswordGrant: false,
  });

  return {
    ...decision,
    rule: decision.kind === 'redirect' ? decision.rule : null,
    linkState: decision.kind === 'block' ? decision.linkState : null,
  };
});
