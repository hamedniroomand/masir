import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findCampaignForWorkspace } from '#server/utils/campaign-repo';
import { VisitLimitBelowUsageError } from '#server/utils/errors';
import { findLinkById, linkToDto, tagNamesByLinkIds, updateLink } from '#server/utils/link-repo';
import { assertScheduleOrder } from '#server/utils/link-schedule';
import { hashSecret } from '#server/utils/password';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { setLinkTags } from '#server/utils/tag-repo';
import { validateDestination, validateFallbackDestination } from '#server/utils/url';
import { CAMPAIGN_UTM_CONFLICT, hasCampaignUtmConflict, maximumVisitsSchema, notesSchema, tagsSchema } from '#shared/link-input';
import { emptyToNull, optionalUtmSchema } from '#shared/utm';

const bodySchema = v.object({
  title: v.optional(v.nullable(v.string())),
  notes: notesSchema,
  destinationUrl: v.optional(v.string()),
  expiresAt: v.optional(v.nullable(v.number())),
  startsAt: v.optional(v.nullable(v.number())),
  expirationDestination: v.optional(v.nullable(v.string())),
  limitDestination: v.optional(v.nullable(v.string())),
  scheduledDestination: v.optional(v.nullable(v.string())),
  maximumVisits: maximumVisitsSchema,
  password: v.optional(v.nullable(v.string())),
  tags: tagsSchema,
  isEnabled: v.optional(v.boolean()),
  slug: v.optional(v.string()),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: optionalUtmSchema,
  utmCampaign: optionalUtmSchema,
  utmTerm: optionalUtmSchema,
  utmContent: optionalUtmSchema,
});

function visitLimitBelowUsage() {
  const reason = 'Maximum visits cannot be less than visits already used.';
  return createError({ statusCode: 422, statusMessage: reason, data: { reason } });
}

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as { slug: string };
  const config = useRuntimeConfig();
  const updateLimit = Number(config.rateLimitUpdatePerMinute) || 60;
  const rl = await rateLimitCheck(`update:${workspaceId}`, updateLimit, 60_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', data: { retryAfterSec: rl.retryAfterSec } });
  }

  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findLinkById(id, workspaceId);
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);
  const { slug } = existing;

  const patch: Parameters<typeof updateLink>[2] = {};
  if (body.title !== undefined)
    patch.title = body.title;
  if (body.notes !== undefined)
    patch.notes = body.notes;
  if (body.isEnabled !== undefined)
    patch.isEnabled = body.isEnabled;
  if (body.expiresAt !== undefined)
    patch.expiresAt = body.expiresAt == null ? null : new Date(body.expiresAt);
  if (body.startsAt !== undefined)
    patch.startsAt = body.startsAt == null ? null : new Date(body.startsAt);
  function fallback(value: string | null | undefined, label: string) {
    if (!value)
      return null;
    const dest = validateFallbackDestination({
      value,
      label,
      allowPrivate: config.allowPrivateDestinations,
      shortDomain: config.public.shortDomain,
      slug,
    });
    if (!dest.ok)
      throw createError({ statusCode: 422, statusMessage: dest.reason, data: { reason: dest.reason } });
    return dest.url;
  }

  if (body.expirationDestination !== undefined)
    patch.expirationDestination = fallback(body.expirationDestination, 'Expiration destination');
  if (body.limitDestination !== undefined)
    patch.limitDestination = fallback(body.limitDestination, 'Limit destination');
  if (body.scheduledDestination !== undefined)
    patch.scheduledDestination = fallback(body.scheduledDestination, 'Scheduled destination');
  if (body.maximumVisits !== undefined) {
    if (body.maximumVisits != null && body.maximumVisits < existing.clickCount)
      throw visitLimitBelowUsage();
    patch.maximumVisits = body.maximumVisits;
  }
  if (body.password !== undefined) {
    if (body.password == null) {
      patch.passwordHash = null;
    }
    else {
      patch.passwordHash = await hashSecret(body.password);
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
    if (campaignId && !await findCampaignForWorkspace(campaignId, workspaceId)) {
      throw createError({ statusCode: 422, statusMessage: 'Campaign not found.', data: { reason: 'Campaign not found.' } });
    }
    patch.campaignId = campaignId;
  }

  // The patch can set either side, so the pair is judged on the row that the
  // write would leave behind.
  const nextCampaignId = patch.campaignId !== undefined ? patch.campaignId : existing.campaignId;
  const nextUtmCampaign = patch.utmCampaign !== undefined ? patch.utmCampaign : existing.utmCampaign;
  if (hasCampaignUtmConflict({ campaignId: nextCampaignId, utmCampaign: nextUtmCampaign })) {
    throw createError({ statusCode: 400, statusMessage: CAMPAIGN_UTM_CONFLICT, data: { reason: CAMPAIGN_UTM_CONFLICT } });
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

  let updated: Awaited<ReturnType<typeof updateLink>>;
  try {
    updated = await updateLink(id, workspaceId, patch);
  }
  catch (error) {
    if (error instanceof VisitLimitBelowUsageError)
      throw visitLimitBelowUsage();
    throw error;
  }
  if (!updated)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (body.tags !== undefined)
    await setLinkTags(id, workspaceId, body.tags);
  if (body.password !== undefined) {
    await writeAuditEvent(
      body.password == null ? 'link_password_removed' : 'link_password_set',
      {},
      { workspaceId, actor: user.id, linkId: id },
    );
  }
  await writeAuditEvent('link_updated', { fields: Object.keys(patch).filter(k => k !== 'passwordHash') }, { workspaceId, actor: user.id, linkId: id });
  const tagMap = await tagNamesByLinkIds([updated.id]);
  return linkToDto(updated, workspace.slug, tagMap.get(updated.id) ?? []);
});
