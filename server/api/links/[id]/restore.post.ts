import type { ShortUrlWorkspace } from '#server/utils/link-repo';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { aliasesForLinks, linkToDto, restoreLink, tagNamesByLinkIds } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as ShortUrlWorkspace;
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await restoreLink(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeAuditEvent('link_restored', { slug: link.slug }, { workspaceId, actor: user.id, linkId: id });

  const tagMap = await tagNamesByLinkIds([id]);
  const aliasMap = await aliasesForLinks([id]);
  return linkToDto(link, workspace, tagMap.get(id) ?? [], aliasMap.get(id) ?? []);
});
