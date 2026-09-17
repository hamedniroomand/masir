import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { writeSecurityEvent } from '#server/utils/security-log';
import { findMemberById, removeMember } from '#server/utils/workspace-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const member = await findMemberById(id, workspaceId);
  if (!member)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // Removing the owner would leave the workspace with nobody who can manage it.
  if (member.role === 'OWNER') {
    const reason = 'Transfer ownership before you remove the owner.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  await removeMember(id, workspaceId);
  await writeSecurityEvent('member_removed', { memberId: id }, { workspaceId, actor: user.id });
  return { ok: true };
});
