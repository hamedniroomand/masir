import { requireUser } from '../../utils/auth';
import { deleteLink } from '../../utils/link-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const ok = await deleteLink(id, user.id);
  if (!ok)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  return { ok: true };
});
