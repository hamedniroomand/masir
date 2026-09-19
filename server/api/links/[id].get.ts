import { requireWorkspaceMember } from '#server/utils/auth';
import { findUserById } from '#server/utils/identity-repo';
import { findLinkById, linkToDto, tagNamesByLinkIds } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const workspace = event.context.workspace as { slug: string };
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const tagMap = await tagNamesByLinkIds([link.id]);
  const creator = link.createdBy ? await findUserById(link.createdBy) : null;
  return {
    ...linkToDto(link, workspace.slug, tagMap.get(link.id) ?? []),
    creator: creator ? { email: creator.email, firstName: creator.firstName, lastName: creator.lastName } : null,
  };
});
