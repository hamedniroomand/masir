import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { writeSecurityEvent } from '#server/utils/security-log';
import { softDeleteWorkspace } from '#server/utils/workspace-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.delete');
  const user = await requireUser(event);
  // Soft deletion. Every lookup filters on deletedAt, so the subdomain stops
  // resolving while the rows stay for recovery.
  await softDeleteWorkspace(workspaceId);
  await writeSecurityEvent('workspace_deleted', { workspaceId }, { workspaceId, actor: user.id });
  return { ok: true };
});
