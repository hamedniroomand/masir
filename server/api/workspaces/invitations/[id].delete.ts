import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { revokeInvitation } from '#server/utils/invitation-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (!await revokeInvitation(id, workspaceId))
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeAuditEvent('invitation_revoked', { invitationId: id }, { workspaceId, actor: user.id });
  return { ok: true };
});
