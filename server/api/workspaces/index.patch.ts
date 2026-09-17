import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { publicUrlOrNull } from '#server/utils/storage';
import { updateWorkspace } from '#server/utils/workspace-repo';

// The address is immutable. It is part of every published short link. The
// logo has its own route, which checks the bytes.
const bodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  const workspace = await updateWorkspace(workspaceId, body);
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeAuditEvent('workspace_updated', { fields: Object.keys(body) }, { workspaceId, actor: user.id });
  return { id: workspace.id, name: workspace.name, slug: workspace.slug, logoUrl: publicUrlOrNull(workspace.logoUrl) };
});
