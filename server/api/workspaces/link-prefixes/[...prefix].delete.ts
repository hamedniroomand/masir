import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { revokeLinkPrefix } from '#server/utils/link-prefix-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const user = await requireUser(event);

  const query = getQuery(event);
  const param = getRouterParam(event, 'prefix');
  const rawPrefix = (typeof query.prefix === 'string' ? query.prefix : param) ?? '';
  const decoded = decodeURIComponent(rawPrefix).trim();
  const prefix = decoded === '_root_' ? '' : decoded;

  const revoked = await revokeLinkPrefix(workspaceId, prefix);
  if (!revoked) {
    throw createError({ statusCode: 404, statusMessage: 'Prefix not found' });
  }

  await writeAuditEvent('workspace_link_prefix_revoked', { prefix }, { workspaceId, actor: user.id });
  return { ok: true, prefix };
});
