import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { softDeleteWorkspace } from '#server/utils/workspace-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.delete');
  const user = await requireUser(event);
  const config = useRuntimeConfig();

  // A single-workspace instance holds exactly one, so this would stop every
  // short link and leave nothing to sign in to. Recreating it does not bring
  // the links back, because they stay attached to the deleted workspace.
  // Dropping the deployment is the way to be finished with an instance.
  if (!config.multiWorkspace) {
    const reason = 'This instance holds one workspace, so it cannot be deleted. Remove the deployment instead.';
    throw createError({ statusCode: 409, statusMessage: reason, data: { reason } });
  }
  // Soft deletion. Every lookup filters on deletedAt, so the subdomain stops
  // resolving while the rows stay for recovery.
  await softDeleteWorkspace(workspaceId);
  await writeAuditEvent('workspace_deleted', { workspaceId }, { workspaceId, actor: user.id });
  return { ok: true };
});
