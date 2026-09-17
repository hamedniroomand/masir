import { requireWorkspaceMember } from '#server/utils/auth';
import { listTags } from '#server/utils/tag-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  return { items: await listTags(workspaceId) };
});
