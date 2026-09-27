import { Buffer } from 'node:buffer';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { parseImportCsv } from '#server/utils/link-import';
import { LINK_IMPORT_MAX_BYTES } from '#shared/link-import';

function invalid(reason: string) {
  return createError({ statusCode: 422, statusMessage: reason, data: { reason } });
}

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  await requireUser(event);
  const config = useRuntimeConfig();

  const form = await readFormData(event);
  const file = form.get('file');
  if (!(file instanceof Blob))
    throw invalid('Choose a CSV file.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0)
    throw invalid('Choose a CSV file.');
  if (bytes.byteLength > LINK_IMPORT_MAX_BYTES)
    throw invalid(`CSV must be at most ${LINK_IMPORT_MAX_BYTES} bytes.`);

  const parsed = await parseImportCsv(workspaceId, bytes, config.allowPrivateDestinations);
  return {
    importId: parsed.importId,
    fileHash: Buffer.from(parsed.fileHash).toString('base64'),
    rowCount: parsed.rowCount,
    rows: parsed.rows,
  };
});
