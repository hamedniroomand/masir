import { getCampaignAnalytics } from '#server/utils/analytics';
import { requireWorkspaceMember } from '#server/utils/auth';
import { campaignToDto, findCampaignForWorkspace } from '#server/utils/campaign-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const campaign = await findCampaignForWorkspace(id, workspaceId);
  if (!campaign)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const periodRaw = getQuery(event).period;
  const period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';

  const data = await getCampaignAnalytics(campaign.id, workspaceId, period);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  return { campaign: campaignToDto(campaign), ...data };
});
