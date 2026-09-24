import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { campaignToDto, findCampaignForWorkspace, getCampaignStats, updateCampaign } from '#server/utils/campaign-repo';
import { CampaignTakenError } from '#server/utils/errors';
import { emptyToNull, utmValueSchema } from '#shared/utm';

const bodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a campaign name.'), v.maxLength(120))),
  utmCampaign: v.optional(v.pipe(utmValueSchema, v.minLength(1, 'Enter a utm_campaign value.'))),
  utmMedium: v.optional(v.nullable(utmValueSchema)),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findCampaignForWorkspace(id, workspaceId);
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);
  const patch: Parameters<typeof updateCampaign>[2] = {};
  if (body.name !== undefined)
    patch.name = body.name;
  if (body.utmCampaign !== undefined)
    patch.utmCampaign = body.utmCampaign;
  if (body.utmMedium !== undefined)
    patch.utmMedium = emptyToNull(body.utmMedium);

  try {
    const updated = await updateCampaign(id, workspaceId, patch);
    await writeAuditEvent('campaign_updated', { fields: Object.keys(patch) }, { workspaceId, actor: user.id });
    if (!updated)
      throw createError({ statusCode: 404, statusMessage: 'Campaign not found' });
    return campaignToDto(updated, await getCampaignStats(id, workspaceId));
  }
  catch (error) {
    if (error instanceof CampaignTakenError)
      throw createError({ statusCode: 409, statusMessage: 'Another campaign already uses this utm_campaign value.', data: { reason: 'Another campaign already uses this utm_campaign value.' } });
    throw error;
  }
});
