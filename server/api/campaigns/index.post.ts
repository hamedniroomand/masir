import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { campaignToDto, createCampaign } from '#server/utils/campaign-repo';
import { CampaignTakenError } from '#server/utils/errors';
import { emptyToNull, utmValueSchema } from '#shared/utm';

const bodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a campaign name.'), v.maxLength(120)),
  utmCampaign: v.pipe(utmValueSchema, v.minLength(1, 'Enter a utm_campaign value.')),
  utmMedium: v.optional(v.nullable(utmValueSchema)),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  try {
    const campaign = await createCampaign({
      workspaceId,
      createdBy: user.id,
      name: body.name,
      utmCampaign: body.utmCampaign,
      utmMedium: emptyToNull(body.utmMedium),
    });
    await writeAuditEvent('campaign_created', { name: body.name }, { workspaceId, actor: user.id });
    setResponseStatus(event, 201);
    if (!campaign)
      throw createError({ statusCode: 500, statusMessage: 'Campaign could not be read back' });
    return campaignToDto(campaign);
  }
  catch (error) {
    if (error instanceof CampaignTakenError)
      throw createError({ statusCode: 409, statusMessage: 'Another campaign already uses this utm_campaign value.', data: { reason: 'Another campaign already uses this utm_campaign value.' } });
    throw error;
  }
});
