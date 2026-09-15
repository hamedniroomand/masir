import { requireUser } from '#server/utils/auth';
import { deleteLink, findLinkByIdForUser } from '#server/utils/link-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findLinkByIdForUser(id, user.id);
  const ok = await deleteLink(id, user.id);
  if (!ok)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeSecurityEvent('link_deleted', { linkId: id, slug: existing?.slug }, user.id);
  return { ok: true };
});
