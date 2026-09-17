import { requireWorkspaceMember } from '#server/utils/auth';
import { deleteTag } from '#server/utils/tag-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const ok = await deleteTag(id, workspaceId);
  if (!ok)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  setResponseStatus(event, 204);
});
