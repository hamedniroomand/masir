import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findMember, setMemberDeactivated, setMemberRole } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  isActive: v.optional(v.boolean()),
  role: v.optional(v.picklist(['MEMBER', 'VIEWER'], 'Choose Member or Viewer.')),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const userId = getRouterParam(event, 'id');
  if (!userId)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const member = await findMember(workspaceId, userId);
  if (!member)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // A deactivated owner could never manage the workspace again, and nobody
  // else may. The same holds for a demoted owner. Transfer first.
  if (member.role === 'OWNER') {
    const reason = 'Transfer ownership before you change the owner.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  const body = await readValidBody(event, bodySchema);
  if (body.role === undefined && body.isActive === undefined) {
    const reason = 'Send a role or an active state.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  if (body.role) {
    await setMemberRole(workspaceId, userId, body.role);
    await writeAuditEvent('member_role_changed', { userId, role: body.role }, { workspaceId, actor: user.id });
  }

  if (body.isActive !== undefined) {
    await setMemberDeactivated(workspaceId, userId, !body.isActive);
    await writeAuditEvent('member_activity_changed', { userId, isActive: body.isActive }, { workspaceId, actor: user.id });
  }

  return { ok: true };
});
