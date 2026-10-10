import { requireUser } from '#server/utils/auth';
import { effectiveRole, isReadOnlyEmail } from '#server/utils/read-only';
import { publicUrlOrNull } from '#server/utils/storage';
import { listMembershipsForUser } from '#server/utils/workspace-repo';
import { appUrl } from '#shared/deployment';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();
  const rows = await listMembershipsForUser(user.id);
  return {
    currentId: (event.context.workspace as { id: string } | undefined)?.id ?? null,
    readOnly: isReadOnlyEmail(user.email),
    items: rows.map(row => ({
      id: row.workspace.id,
      name: row.workspace.name,
      slug: row.workspace.slug,
      linkPrefix: row.workspace.linkPrefix,
      logoUrl: publicUrlOrNull(row.workspace.logoUrl),
      role: effectiveRole(user.email, row.role),
      url: appUrl(config as never),
    })),
  };
});
