import { requireUser } from '#server/utils/auth';
import { listMembershipsForUser } from '#server/utils/workspace-repo';
import { workspaceUrl } from '#shared/deployment';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();
  const rows = await listMembershipsForUser(user.id);
  return {
    multiWorkspace: Boolean(config.multiWorkspace),
    items: rows.map(row => ({
      id: row.workspace.id,
      name: row.workspace.name,
      slug: row.workspace.slug,
      logoUrl: row.workspace.logoUrl,
      role: row.role,
      url: workspaceUrl(row.workspace.slug, config as never),
    })),
  };
});
