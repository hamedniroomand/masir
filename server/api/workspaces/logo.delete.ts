import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireMemberOf, requireUser } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { deleteObject } from '#server/utils/storage';
import { findWorkspaceById, updateWorkspace } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  workspaceId: v.string(),
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const { workspaceId } = await readValidBody(event, bodySchema);
  await requireMemberOf(event, workspaceId, 'workspace.manage');

  const key = (await findWorkspaceById(workspaceId))?.logoUrl;
  if (key) {
    await updateWorkspace(workspaceId, { logoUrl: null });
    await deleteObject(key);
    await writeAuditEvent('workspace_updated', { fields: ['logoUrl'] }, { workspaceId, actor: user.id });
  }
  return { logoUrl: null };
});
