import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { findLinkById, removeAlias } from '#server/utils/link-repo';
import { normalizeSlug } from '#shared/slug';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  const slug = getRouterParam(event, 'slug');
  if (!id || !slug)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const normalized = normalizeSlug(slug);
  if (!await removeAlias(workspaceId, id, normalized))
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeAuditEvent('link_alias_removed', { slug: normalized }, { workspaceId, actor: user.id, linkId: id });
  return { ok: true };
});
