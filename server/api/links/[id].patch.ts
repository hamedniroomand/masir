import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { findCampaignForUser } from '#server/utils/campaign-repo';
import { findLinkByIdForUser, linkToDto, tagNamesByLinkIds, updateLink } from '#server/utils/link-repo';
import { assertScheduleOrder } from '#server/utils/link-schedule';
import { writeSecurityEvent } from '#server/utils/security-log';
import { setLinkTags } from '#server/utils/tag-repo';
import { shortLinkMatchesDestination, validateDestination } from '#server/utils/url';
import { emptyToNull, optionalUtmSchema } from '#shared/utm';

const bodySchema = v.object({
  title: v.optional(v.nullable(v.string())),
  destinationUrl: v.optional(v.string()),
  expiresAt: v.optional(v.nullable(v.number())),
  startsAt: v.optional(v.nullable(v.number())),
  expirationDestination: v.optional(v.nullable(v.string())),
  maximumVisits: v.optional(v.nullable(v.number())),
  password: v.optional(v.nullable(v.string())),
  tags: v.optional(v.array(v.string())),
  isEnabled: v.optional(v.boolean()),
  slug: v.optional(v.string()),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: optionalUtmSchema,
  utmCampaign: optionalUtmSchema,
  utmTerm: optionalUtmSchema,
  utmContent: optionalUtmSchema,
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findLinkByIdForUser(id, user.id);
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = v.parse(bodySchema, await readBody(event));
  const config = useRuntimeConfig();

  const patch: Parameters<typeof updateLink>[2] = {};
  if (body.title !== undefined)
    patch.title = body.title;
  if (body.isEnabled !== undefined)
    patch.isEnabled = body.isEnabled;
  if (body.expiresAt !== undefined)
    patch.expiresAt = body.expiresAt == null ? null : new Date(body.expiresAt);
  if (body.startsAt !== undefined)
    patch.startsAt = body.startsAt == null ? null : new Date(body.startsAt);
  if (body.expirationDestination !== undefined) {
    if (body.expirationDestination == null) {
      patch.expirationDestination = null;
    }
    else {
      const dest = validateDestination(body.expirationDestination, config.allowPrivateDestinations);
      if (!dest.ok) {
        throw createError({ statusCode: 422, statusMessage: dest.reason, data: { reason: dest.reason } });
      }
      if (shortLinkMatchesDestination(config.public.shortDomain, existing.slug, dest.url)) {
        throw createError({
          statusCode: 422,
          statusMessage: 'Expiration destination cannot point to this short link.',
          data: { reason: 'Expiration destination cannot point to this short link.' },
        });
      }
      patch.expirationDestination = dest.url;
    }
  }
  if (body.maximumVisits !== undefined) {
    if (body.maximumVisits != null && body.maximumVisits < existing.successfulVisitCount) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Maximum visits cannot be less than visits already used.',
        data: { reason: 'Maximum visits cannot be less than visits already used.' },
      });
    }
    patch.maximumVisits = body.maximumVisits;
  }
  if (body.password !== undefined) {
    if (body.password == null) {
      patch.passwordHash = null;
    }
    else {
      patch.passwordHash = await hashPassword(body.password);
    }
  }
  if (body.utmSource !== undefined)
    patch.utmSource = emptyToNull(body.utmSource);
  if (body.utmCampaign !== undefined)
    patch.utmCampaign = emptyToNull(body.utmCampaign);
  if (body.utmTerm !== undefined)
    patch.utmTerm = emptyToNull(body.utmTerm);
  if (body.utmContent !== undefined)
    patch.utmContent = emptyToNull(body.utmContent);
  if (body.campaignId !== undefined) {
    const campaignId = emptyToNull(body.campaignId);
    if (campaignId && !await findCampaignForUser(campaignId, user.id)) {
      throw createError({ statusCode: 422, statusMessage: 'Campaign not found.', data: { reason: 'Campaign not found.' } });
    }
    patch.campaignId = campaignId;
  }
  if (body.destinationUrl !== undefined) {
    const dest = validateDestination(body.destinationUrl, config.allowPrivateDestinations);
    if (!dest.ok) {
      throw createError({ statusCode: 422, statusMessage: dest.reason, data: { reason: dest.reason } });
    }
    patch.destinationUrl = dest.url;
  }

  const nextStarts = patch.startsAt !== undefined ? patch.startsAt : existing.startsAt;
  const nextExpires = patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt;
  assertScheduleOrder(nextStarts, nextExpires);

  if (body.tags !== undefined)
    await setLinkTags(id, user.id, body.tags);

  const updated = await updateLink(id, user.id, patch);
  if (body.password !== undefined) {
    await writeSecurityEvent(
      body.password == null ? 'link_password_removed' : 'link_password_set',
      {},
      user.id,
      id,
    );
  }
  await writeSecurityEvent('link_updated', { fields: Object.keys(patch).filter(k => k !== 'passwordHash') }, user.id, id);
  const tagMap = await tagNamesByLinkIds([updated!.id]);
  return linkToDto(updated!, tagMap.get(updated!.id) ?? []);
});
