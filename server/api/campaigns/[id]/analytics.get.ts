import { getCampaignAnalytics } from '#server/utils/analytics';
import { readAnalyticsOptions } from '#server/utils/analytics-query';
import { requireWorkspaceMember } from '#server/utils/auth';
import { campaignToDto, findCampaignForWorkspace, getCampaignStats } from '#server/utils/campaign-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const campaign = await findCampaignForWorkspace(id, workspaceId);
  if (!campaign)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const attributionRaw = getQuery(event).attribution;
  const attribution = attributionRaw === 'recorded' ? 'recorded' : 'current';
  const options = readAnalyticsOptions(event);

  const data = await getCampaignAnalytics(campaign.id, workspaceId, options, attribution);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  return { campaign: campaignToDto(campaign, await getCampaignStats(id, workspaceId)), ...data };
});
