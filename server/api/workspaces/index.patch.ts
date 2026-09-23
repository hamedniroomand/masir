import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { changeLinkPrefix } from '#server/utils/link-prefix-repo';
import { publicUrlOrNull } from '#server/utils/storage';
import { findWorkspaceById, updateWorkspace } from '#server/utils/workspace-repo';
import { linkPrefixSchema } from '#shared/link-prefix';

// The address is immutable. It is part of every published short link. The
// prefix can change, and the settings page warns that old links then break.
// The logo has its own route, which checks the bytes.
const bodySchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
  linkPrefix: v.optional(linkPrefixSchema),
  pathMode: v.optional(v.picklist(['preserve', 'replace'])),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  const current = await findWorkspaceById(workspaceId);
  if (!current)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (body.linkPrefix !== undefined) {
    const mode = body.pathMode ?? 'replace';
    await changeLinkPrefix(workspaceId, body.linkPrefix, mode);
    if (current.linkPrefix !== (body.linkPrefix?.trim() || null)) {
      await writeAuditEvent('workspace_link_prefix_changed', { from: current.linkPrefix, to: body.linkPrefix, mode }, { workspaceId, actor: user.id });
    }
  }

  if (body.name !== undefined) {
    await updateWorkspace(workspaceId, { name: body.name });
  }

  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeAuditEvent('workspace_updated', { fields: Object.keys(body) }, { workspaceId, actor: user.id });
  return { id: workspace.id, name: workspace.name, slug: workspace.slug, linkPrefix: workspace.linkPrefix, logoUrl: publicUrlOrNull(workspace.logoUrl) };
});
