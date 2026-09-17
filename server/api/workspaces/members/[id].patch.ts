import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findMember, setMemberDeactivated } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  isActive: v.boolean(),
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
  // else may. Transfer first.
  if (member.role === 'OWNER') {
    const reason = 'Transfer ownership before you deactivate the owner.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  const body = await readValidBody(event, bodySchema);
  await setMemberDeactivated(workspaceId, userId, !body.isActive);
  await writeAuditEvent('member_activity_changed', { userId, isActive: body.isActive }, { workspaceId, actor: user.id });
  return { ok: true };
});
