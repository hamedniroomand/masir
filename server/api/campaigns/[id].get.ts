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

  return campaignToDto(campaign);
});
