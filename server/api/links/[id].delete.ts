import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { deleteLink, findLinkById } from '#server/utils/link-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findLinkById(id, workspaceId);
  const ok = await deleteLink(id, workspaceId);
  if (!ok)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeSecurityEvent('link_deleted', { linkId: id, slug: existing?.slug }, user.id);
  return { ok: true };
});
