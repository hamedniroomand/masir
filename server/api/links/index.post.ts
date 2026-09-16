import { setResponseHeader } from 'h3';
import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { findCampaignForUser } from '#server/utils/campaign-repo';
import { createLink, linkToDto, SlugExhaustedError, SlugTakenError, tagNamesByLinkIds } from '#server/utils/link-repo';
import { assertScheduleOrder } from '#server/utils/link-schedule';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { writeSecurityEvent } from '#server/utils/security-log';
import { setLinkTags } from '#server/utils/tag-repo';
import { validateDestination } from '#server/utils/url';
import { slugSchema } from '#shared/slug';
import { emptyToNull, optionalUtmSchema } from '#shared/utm';

const bodySchema = v.object({
  destinationUrl: v.pipe(v.string(), v.minLength(1)),
  slug: v.optional(v.string()),
  title: v.optional(v.nullable(v.string())),
  expiresAt: v.optional(v.nullable(v.number())),
  startsAt: v.optional(v.nullable(v.number())),
  expirationDestination: v.optional(v.nullable(v.string())),
  maximumVisits: v.optional(v.nullable(v.number())),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: optionalUtmSchema,
  utmContent: optionalUtmSchema,
  tags: v.optional(v.array(v.string())),
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();
  const createLimit = Number(config.rateLimitCreatePerHour) || 30;
  const rl = rateLimitCheck(`create:${user.id}`, createLimit, 3_600_000);
  if (!rl.ok) {
    await writeSecurityEvent('rate_limit_exceeded', { scope: 'create' }, user.id);
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', data: { retryAfterSec: rl.retryAfterSec } });
  }

  const body = v.parse(bodySchema, await readBody(event));
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

  let expirationDestination: string | null = null;
  if (body.expirationDestination) {
    const expDest = validateDestination(body.expirationDestination, config.allowPrivateDestinations);
    if (!expDest.ok) {
      throw createError({ statusCode: 422, statusMessage: expDest.reason, data: { reason: expDest.reason } });
    }
    expirationDestination = expDest.url;
  }

  const maximumVisits = body.maximumVisits ?? null;

  const campaignId = emptyToNull(body.campaignId);
  if (campaignId && !await findCampaignForUser(campaignId, user.id)) {
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

  try {
    const link = await createLink({
      userId: user.id,
      destinationUrl: dest.url,
      title: body.title,
      slug,
      expiresAt,
      startsAt,
      expirationDestination,
      maximumVisits,
      campaignId,
      utmSource: emptyToNull(body.utmSource),
      utmContent: emptyToNull(body.utmContent),
    });
    if (body.tags?.length)
      await setLinkTags(link.id, user.id, body.tags);
    await writeSecurityEvent('link_created', { slug: link.slug }, user.id, link.id);
    setResponseStatus(event, 201);
    const tagMap = await tagNamesByLinkIds([link.id]);
    return linkToDto(link, tagMap.get(link.id) ?? []);
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
