import { requireWorkspaceMember } from '#server/utils/auth';
import { listRetainedPrefixes } from '#server/utils/link-prefix-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const rows = await listRetainedPrefixes(workspaceId);

  return {
    items: rows.map(row => ({
      prefix: row.prefix,
      state: row.state,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    })),
  };
});
