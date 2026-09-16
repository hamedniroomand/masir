import { requireUser } from '#server/utils/auth';
import { deleteTag } from '#server/utils/tag-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const ok = await deleteTag(id, user.id);
  if (!ok)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  setResponseStatus(event, 204);
});
