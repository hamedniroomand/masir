import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { deleteCampaign } from '#server/utils/campaign-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const removed = await deleteCampaign(id, workspaceId);
  if (!removed)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeSecurityEvent('campaign_deleted', { campaignId: id }, { workspaceId, actor: user.id });
  setResponseStatus(event, 204);
  return null;
});
