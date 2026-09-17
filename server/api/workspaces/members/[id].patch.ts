import * as v from 'valibot';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { writeSecurityEvent } from '#server/utils/security-log';
import { findMemberById, setMemberDeactivated } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  isActive: v.boolean(),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const member = await findMemberById(id, workspaceId);
  if (!member)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // A deactivated owner could never manage the workspace again, and nobody
  // else may. Transfer first.
  if (member.role === 'OWNER') {
    const reason = 'Transfer ownership before you deactivate the owner.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  const body = await readValidBody(event, bodySchema);
  await setMemberDeactivated(id, workspaceId, !body.isActive);
  await writeSecurityEvent('member_activity_changed', { memberId: id, isActive: body.isActive }, { workspaceId, actor: user.id });
  return { ok: true };
});
