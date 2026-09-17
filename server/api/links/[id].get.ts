import { requireWorkspaceMember } from '#server/utils/auth';
import { findLinkById, linkToDto, tagNamesByLinkIds } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const workspace = event.context.workspace as { slug: string };
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const tagMap = await tagNamesByLinkIds([link.id]);
  return linkToDto(link, workspace.slug, tagMap.get(link.id) ?? []);
});
