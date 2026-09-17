import * as v from 'valibot';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { campaignToDto, findCampaignForWorkspace, updateCampaign } from '#server/utils/campaign-repo';
import { CampaignTakenError } from '#server/utils/errors';
import { writeSecurityEvent } from '#server/utils/security-log';
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

  const body = v.parse(bodySchema, await readBody(event));
  const patch: Parameters<typeof updateCampaign>[2] = {};
  if (body.name !== undefined)
    patch.name = body.name;
  if (body.utmCampaign !== undefined)
    patch.utmCampaign = body.utmCampaign;
  if (body.utmMedium !== undefined)
    patch.utmMedium = emptyToNull(body.utmMedium);

  try {
    const updated = await updateCampaign(id, workspaceId, patch);
    await writeSecurityEvent('campaign_updated', { fields: Object.keys(patch) }, user.id);
    return campaignToDto(updated!);
  }
  catch (e) {
    if (e instanceof CampaignTakenError)
      throw createError({ statusCode: 409, statusMessage: 'Another campaign already uses this utm_campaign value.', data: { reason: 'Another campaign already uses this utm_campaign value.' } });
    throw e;
  }
});
