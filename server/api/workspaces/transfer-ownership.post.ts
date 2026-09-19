import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { demoRefusal } from '#server/utils/demo';
import { findMember, listMembers, transferOwnership } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as { expiresAt: Date | null };
  if (workspace.expiresAt != null)
    throw demoRefusal('A demo workspace cannot change owner.');

  const body = await readValidBody(event, bodySchema);

  const target = await findMember(workspaceId, body.userId);
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

  await transferOwnership(workspaceId, current.userId, body.userId);
  await writeAuditEvent('ownership_transferred', { to: body.userId }, { workspaceId, actor: user.id });
  return { ok: true };
});
