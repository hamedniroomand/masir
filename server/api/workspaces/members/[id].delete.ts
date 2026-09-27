import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { clearLinkResponsibility } from '#server/utils/link-repo';
import { findMember, removeMember } from '#server/utils/workspace-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const userId = getRouterParam(event, 'id');
  if (!userId)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const member = await findMember(workspaceId, userId);
  if (!member)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // Removing the owner would leave the workspace with nobody who can manage it.
  if (member.role === 'OWNER') {
    const reason = 'Transfer ownership before you remove the owner.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  await removeMember(workspaceId, userId);
  await clearLinkResponsibility(workspaceId, userId);
  await writeAuditEvent('member_removed', { userId }, { workspaceId, actor: user.id });
  return { ok: true };
});
