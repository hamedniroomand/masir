import { setResponseHeader } from 'h3';
import * as v from 'valibot';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findCampaignForWorkspace } from '#server/utils/campaign-repo';
import { SlugExhaustedError, SlugTakenError } from '#server/utils/errors';
import { createLink, linkToDto, tagNamesByLinkIds } from '#server/utils/link-repo';
import { assertScheduleOrder } from '#server/utils/link-schedule';
import { hashSecret } from '#server/utils/password';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { writeSecurityEvent } from '#server/utils/security-log';
import { setLinkTags } from '#server/utils/tag-repo';
import { shortLinkMatchesDestination, validateDestination } from '#server/utils/url';
import { maximumVisitsSchema, tagsSchema } from '#shared/link-input';
import { slugSchema } from '#shared/slug';
import { emptyToNull, optionalUtmSchema } from '#shared/utm';

const bodySchema = v.object({
  destinationUrl: v.pipe(v.string(), v.minLength(1)),
  slug: v.optional(v.string()),
  title: v.optional(v.nullable(v.string())),
  expiresAt: v.optional(v.nullable(v.number())),
  startsAt: v.optional(v.nullable(v.number())),
  expirationDestination: v.optional(v.nullable(v.string())),
  maximumVisits: maximumVisitsSchema,
  password: v.optional(v.nullable(v.string())),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: optionalUtmSchema,
  utmCampaign: optionalUtmSchema,
  utmTerm: optionalUtmSchema,
  utmContent: optionalUtmSchema,
  tags: tagsSchema,
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as { slug: string };
  const config = useRuntimeConfig();
  const createLimit = Number(config.rateLimitCreatePerHour) || 30;
  const rl = await rateLimitCheck(`create:${workspaceId}`, createLimit, 3_600_000);
  if (!rl.ok) {
    await writeSecurityEvent('rate_limit_exceeded', { scope: 'create' }, user.id);
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', data: { retryAfterSec: rl.retryAfterSec } });
  }

  const body = await readValidBody(event, bodySchema);
  const dest = validateDestination(body.destinationUrl, config.allowPrivateDestinations);
  if (!dest.ok) {
    throw createError({ statusCode: 422, statusMessage: dest.reason, data: { reason: dest.reason } });
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt != null) {
    if (body.expiresAt <= Date.now()) {
      throw createError({ statusCode: 422, statusMessage: 'Expiry must be in the future.', data: { reason: 'Expiry must be in the future.' } });
    }
    expiresAt = new Date(body.expiresAt);
  }

  let startsAt: Date | null = null;
  if (body.startsAt != null)
    startsAt = new Date(body.startsAt);

  assertScheduleOrder(startsAt, expiresAt);

  const maximumVisits = body.maximumVisits ?? null;

  const campaignId = emptyToNull(body.campaignId);
  if (campaignId && !await findCampaignForWorkspace(campaignId, workspaceId)) {
    throw createError({ statusCode: 422, statusMessage: 'Campaign not found.', data: { reason: 'Campaign not found.' } });
  }

  let slug: string | undefined;
  if (body.slug) {
    const parsed = v.safeParse(slugSchema, body.slug);
    if (!parsed.success) {
      const reason = parsed.issues[0]!.message;
      throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
    }
    slug = parsed.output;
  }

  let expirationDestination: string | null = null;
  if (body.expirationDestination) {
    const expDest = validateDestination(body.expirationDestination, config.allowPrivateDestinations);
    if (!expDest.ok) {
      throw createError({ statusCode: 422, statusMessage: expDest.reason, data: { reason: expDest.reason } });
    }
    if (slug && shortLinkMatchesDestination(config.public.shortDomain, slug, expDest.url)) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Expiration destination cannot point to this short link.',
        data: { reason: 'Expiration destination cannot point to this short link.' },
      });
    }
    expirationDestination = expDest.url;
  }

  try {
    const link = await createLink({
      workspaceId,
      createdByUserId: user.id,
      destinationUrl: dest.url,
      title: body.title,
      slug,
      expiresAt,
      startsAt,
      expirationDestination,
      maximumVisits,
      passwordHash: body.password ? await hashSecret(body.password) : null,
      campaignId,
      utmSource: emptyToNull(body.utmSource),
      utmCampaign: emptyToNull(body.utmCampaign),
      utmTerm: emptyToNull(body.utmTerm),
      utmContent: emptyToNull(body.utmContent),
    });
    if (body.tags?.length)
      await setLinkTags(link.id, workspaceId, body.tags);
    await writeSecurityEvent('link_created', { slug: link.slug }, user.id, link.id);
    setResponseStatus(event, 201);
    const tagMap = await tagNamesByLinkIds([link.id]);
    return linkToDto(link, workspace.slug, tagMap.get(link.id) ?? []);
  }
  catch (e) {
    if (e instanceof SlugTakenError) {
      throw createError({ statusCode: 409, statusMessage: 'This short link is already taken.', data: { reason: 'This short link is already taken.' } });
    }
    if (e instanceof SlugExhaustedError) {
      await writeSecurityEvent('slug_generation_exhausted', {}, user.id);
      throw createError({ statusCode: 500, statusMessage: 'Could not generate a slug.' });
    }
    throw e;
  }
});
