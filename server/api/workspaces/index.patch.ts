import * as v from 'valibot';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { writeSecurityEvent } from '#server/utils/security-log';
import { updateWorkspace } from '#server/utils/workspace-repo';

// The address is immutable. It is part of every published short link.
const bodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
  logoUrl: v.optional(v.nullable(v.string())),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  const workspace = await updateWorkspace(workspaceId, body);
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeSecurityEvent('workspace_updated', { fields: Object.keys(body) }, user.id);
  return { id: workspace.id, name: workspace.name, slug: workspace.slug, logoUrl: workspace.logoUrl };
});
