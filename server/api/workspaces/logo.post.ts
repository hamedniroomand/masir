import { writeAuditEvent } from '#server/utils/audit-log';
import { requireMemberOf, requireUser } from '#server/utils/auth';
import { validateImage } from '#server/utils/image-validate';
import { deleteObject, publicUrl, putObject } from '#server/utils/storage';
import { logoStorageKey } from '#server/utils/storage-key';
import { findWorkspaceById, updateWorkspace } from '#server/utils/workspace-repo';

function invalid(reason: string) {
  return createError({ statusCode: 422, statusMessage: reason, data: { reason } });
}

// ponytail: readFormData buffers the whole body before validateImage sees its
// size. A streaming cap needs a helper that reads the body itself.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const form = await readFormData(event);
  const workspaceId = form.get('workspaceId');
  const file = form.get('file');
  if (typeof workspaceId !== 'string')
    throw invalid('Choose a workspace.');
  if (!(file instanceof Blob))
    throw invalid('Choose an image file.');
  await requireMemberOf(event, workspaceId, 'workspace.manage');

  const maxBytes = Number(useRuntimeConfig().storage.maxUploadBytes) || 2_097_152;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = validateImage(bytes, maxBytes);
  if (!image.ok)
    throw invalid(image.reason);

  const previous = (await findWorkspaceById(workspaceId))?.logoUrl ?? null;
  const key = logoStorageKey(workspaceId, image.type);
  await putObject(key, bytes, image.type);
  await updateWorkspace(workspaceId, { logoUrl: key });
  if (previous)
    await deleteObject(previous);

  await writeAuditEvent('workspace_updated', { fields: ['logoUrl'] }, { workspaceId, actor: user.id });
  return { logoUrl: publicUrl(key) };
});
