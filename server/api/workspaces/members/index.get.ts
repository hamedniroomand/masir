import { requireWorkspaceMember } from '#server/utils/auth';
import { listMembers } from '#server/utils/workspace-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const rows = await listMembers(workspaceId);
  return {
    items: rows.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      isActive: row.deactivatedAt == null,
      createdAt: row.createdAt,
    })),
  };
});
