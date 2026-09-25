import { requireWorkspaceMember } from '#server/utils/auth';
import { listMembers } from '#server/utils/workspace-repo';

// Link editors assign responsibility. They need active members without the
// full members.manage surface used on the settings page.
export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const rows = await listMembers(workspaceId);
  return {
    items: rows
      .filter(row => row.deactivatedAt == null)
      .map(row => ({
        userId: row.userId,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
      })),
  };
});
