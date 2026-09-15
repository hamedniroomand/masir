import { setResponseHeader } from 'h3';
import * as v from 'valibot';
import { requireUser } from '../../utils/auth';
import { createLink, linkToDto, SlugExhaustedError, SlugTakenError } from '../../utils/link-repo';
import { rateLimitCheck } from '../../utils/rate-limit';
import { writeSecurityEvent } from '../../utils/security-log';
import { normalizeSlug, validateSlug } from '../../utils/slug';
import { validateDestination } from '../../utils/url';

const bodySchema = v.object({
  destinationUrl: v.pipe(v.string(), v.minLength(1)),
  slug: v.optional(v.string()),
  title: v.optional(v.nullable(v.string())),
  expiresAt: v.optional(v.nullable(v.number())),
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

  let slug: string | undefined;
  if (body.slug) {
    slug = normalizeSlug(body.slug);
    const check = validateSlug(slug);
    if (!check.ok) {
      throw createError({ statusCode: 422, statusMessage: check.reason, data: { reason: check.reason } });
    }
  }

  try {
    const link = await createLink({
      userId: user.id,
      destinationUrl: dest.url,
      title: body.title,
      slug,
      expiresAt,
    });
    setResponseStatus(event, 201);
    return linkToDto(link);
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
