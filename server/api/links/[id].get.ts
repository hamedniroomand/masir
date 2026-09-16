import { requireUser } from '#server/utils/auth';
import { findLinkByIdForUser, linkToDto, tagNamesByLinkIds } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkByIdForUser(id, user.id);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const tagMap = await tagNamesByLinkIds([link.id]);
  return linkToDto(link, tagMap.get(link.id) ?? []);
});
