import * as v from 'valibot';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { writeSecurityEvent } from '#server/utils/security-log';
import { findMemberById, listMembers, transferOwnership } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  memberId: v.pipe(v.string(), v.minLength(1)),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  const target = await findMemberById(body.memberId, workspaceId);
  if (!target)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (target.role === 'OWNER')
    return { ok: true };

  if (target.deactivatedAt) {
    const reason = 'Reactivate this member before you transfer ownership.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  const current = (await listMembers(workspaceId)).find(member => member.role === 'OWNER');
  if (!current)
    throw createError({ statusCode: 409, statusMessage: 'This workspace has no owner.' });

  await transferOwnership(workspaceId, current.id, body.memberId);
  await writeSecurityEvent('ownership_transferred', { to: body.memberId }, { workspaceId, actor: user.id });
  return { ok: true };
});
