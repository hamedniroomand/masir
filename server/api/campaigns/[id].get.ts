import { requireUser } from '#server/utils/auth';
import { campaignToDto, findCampaignForUser } from '#server/utils/campaign-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const campaign = await findCampaignForUser(id, user.id);
  if (!campaign)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  return campaignToDto(campaign);
});
