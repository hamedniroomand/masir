import { getCampaignAnalytics } from '#server/utils/analytics';
import { requireWorkspaceMember } from '#server/utils/auth';
import { campaignToDto, findCampaignForWorkspace } from '#server/utils/campaign-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const campaign = await findCampaignForWorkspace(id, workspaceId);
  if (!campaign)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const query = getQuery(event);
  const periodRaw = query.period;
  const period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';

  const attributionRaw = query.attribution;
  const attribution = attributionRaw === 'recorded' ? 'recorded' : 'current';

  const data = await getCampaignAnalytics(campaign.id, workspaceId, period, attribution);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  return { campaign: campaignToDto(campaign), ...data };
});
