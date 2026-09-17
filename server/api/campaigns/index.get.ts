import { requireWorkspaceMember } from '#server/utils/auth';
import { listCampaigns } from '#server/utils/campaign-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const items = await listCampaigns(workspaceId);
  return { items, total: items.length };
});
