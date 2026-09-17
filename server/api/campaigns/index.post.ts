import * as v from 'valibot';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { campaignToDto, createCampaign } from '#server/utils/campaign-repo';
import { CampaignTakenError } from '#server/utils/errors';
import { writeSecurityEvent } from '#server/utils/security-log';
import { emptyToNull, utmValueSchema } from '#shared/utm';

const bodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a campaign name.'), v.maxLength(120)),
  utmCampaign: v.pipe(utmValueSchema, v.minLength(1, 'Enter a utm_campaign value.')),
  utmMedium: v.optional(v.nullable(utmValueSchema)),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const body = v.parse(bodySchema, await readBody(event));

  try {
    const campaign = await createCampaign({
      workspaceId,
      createdByUserId: user.id,
      name: body.name,
      utmCampaign: body.utmCampaign,
      utmMedium: emptyToNull(body.utmMedium),
    });
    await writeSecurityEvent('campaign_created', { name: body.name }, user.id);
    setResponseStatus(event, 201);
    return campaignToDto(campaign!);
  }
  catch (e) {
    if (e instanceof CampaignTakenError)
      throw createError({ statusCode: 409, statusMessage: 'Another campaign already uses this utm_campaign value.', data: { reason: 'Another campaign already uses this utm_campaign value.' } });
    throw e;
  }
});
