import { requireWorkspaceMember } from '#server/utils/auth';
import { listPendingInvitations } from '#server/utils/invitation-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const rows = await listPendingInvitations(workspaceId);
  // The token hash never leaves the server.
  return {
    items: rows.map(row => ({
      id: row.id,
      email: row.email,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    })),
  };
});
