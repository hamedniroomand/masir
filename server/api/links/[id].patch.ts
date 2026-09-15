import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { findLinkByIdForUser, linkToDto, updateLink } from '#server/utils/link-repo';
import { writeSecurityEvent } from '#server/utils/security-log';
import { validateDestination } from '#server/utils/url';

const bodySchema = v.object({
  title: v.optional(v.nullable(v.string())),
  destinationUrl: v.optional(v.string()),
  expiresAt: v.optional(v.nullable(v.number())),
  isEnabled: v.optional(v.boolean()),
  slug: v.optional(v.string()),
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
  if (body.destinationUrl !== undefined) {
    const dest = validateDestination(body.destinationUrl, config.allowPrivateDestinations);
    if (!dest.ok) {
      throw createError({ statusCode: 422, statusMessage: dest.reason, data: { reason: dest.reason } });
    }
    patch.destinationUrl = dest.url;
  }

  const updated = await updateLink(id, user.id, patch);
  await writeSecurityEvent('link_updated', { fields: Object.keys(patch) }, user.id, id);
  return linkToDto(updated!);
});
