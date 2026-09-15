import { getCampaignAnalytics } from '#server/utils/analytics';
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

  const periodRaw = getQuery(event).period;
  const period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';

  const data = await getCampaignAnalytics(campaign.id, period);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  return { campaign: campaignToDto(campaign), ...data };
});
