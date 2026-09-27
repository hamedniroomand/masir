import type { ShortUrlWorkspace } from '#server/utils/link-repo';
import type { LinkImportValues } from '#shared/link-import';
import { Buffer } from 'node:buffer';
import { setResponseHeader } from 'h3';
import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { DEMO_LINK_CAP, demoRefusal } from '#server/utils/demo';
import { AlreadyImportedError, SlugExhaustedError, SlugTakenError } from '#server/utils/errors';
import {
  ensureLinkImport,
  importIdFor,
  validateImportValues,
  valuesToCreateFields,
} from '#server/utils/link-import';
import { countLiveLinks, createLink, findLinkByImportRow } from '#server/utils/link-repo';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { setLinkTags } from '#server/utils/tag-repo';
import {
  emptyImportValues,
  LINK_IMPORT_COLUMNS,
  LINK_IMPORT_MAX_ROWS,

} from '#shared/link-import';

const valuesSchema = v.object({
  slug: v.optional(v.string(), ''),
  destination_url: v.optional(v.string(), ''),
  title: v.optional(v.string(), ''),
  tags: v.optional(v.string(), ''),
  utm_source: v.optional(v.string(), ''),
  utm_medium: v.optional(v.string(), ''),
  utm_campaign: v.optional(v.string(), ''),
  utm_term: v.optional(v.string(), ''),
  utm_content: v.optional(v.string(), ''),
  starts_at: v.optional(v.string(), ''),
  expires_at: v.optional(v.string(), ''),
});

const rowSchema = v.object({
  row: v.pipe(v.number(), v.integer(), v.minValue(1)),
  values: valuesSchema,
});

const bodySchema = v.object({
  importId: v.pipe(v.string(), v.uuid()),
  fileHash: v.pipe(v.string(), v.minLength(1)),
  rows: v.pipe(
    v.array(rowSchema),
    v.minLength(1, 'Send at least one row.'),
    v.maxLength(LINK_IMPORT_MAX_ROWS, `Import at most ${LINK_IMPORT_MAX_ROWS} rows.`),
  ),
});

function decodeFileHash(raw: string): Uint8Array {
  try {
    return Uint8Array.from(Buffer.from(raw, 'base64'));
  }
  catch {
    throw createError({ statusCode: 422, statusMessage: 'Invalid file hash.', data: { reason: 'Invalid file hash.' } });
  }
}

function asValues(input: v.InferOutput<typeof valuesSchema>): LinkImportValues {
  const values = emptyImportValues();
  for (const column of LINK_IMPORT_COLUMNS)
    values[column] = input[column] ?? '';
  return values;
}

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as ShortUrlWorkspace & { expiresAt: Date | null };
  const config = useRuntimeConfig();
  const body = await readValidBody(event, bodySchema);

  const fileHash = decodeFileHash(body.fileHash);
  if (fileHash.byteLength !== 32)
    throw createError({ statusCode: 422, statusMessage: 'Invalid file hash.', data: { reason: 'Invalid file hash.' } });
  if (importIdFor(workspaceId, fileHash) !== body.importId) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Import id does not match the file hash.',
      data: { reason: 'Import id does not match the file hash.' },
    });
  }

  const createLimit = Number(config.rateLimitCreatePerHour) || 30;
  for (let i = 0; i < body.rows.length; i++) {
    const rl = await rateLimitCheck(`create:${workspaceId}`, createLimit, 3_600_000);
    if (!rl.ok) {
      await writeAuditEvent('rate_limit_exceeded', { scope: 'create' }, { workspaceId, actor: user.id });
      setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', data: { retryAfterSec: rl.retryAfterSec } });
    }
  }

  if (workspace.expiresAt != null && await countLiveLinks(workspaceId) + body.rows.length > DEMO_LINK_CAP)
    throw demoRefusal(`The demo allows ${DEMO_LINK_CAP} links.`);

  await ensureLinkImport({
    importId: body.importId,
    workspaceId,
    createdBy: user.id,
    fileHash,
    rowCount: body.rows.length,
  });

  const seenSlugs = new Set<string>();
  const results: {
    row: number;
    status: 'created' | 'already_imported' | 'conflict' | 'error';
    linkId?: string;
    error?: string;
  }[] = [];

  for (const item of body.rows) {
    const prior = await findLinkByImportRow(body.importId, item.row);
    if (prior) {
      results.push({ row: item.row, status: 'already_imported', linkId: prior.id });
      continue;
    }

    const values = asValues(item.values);
    const errors = await validateImportValues(
      workspaceId,
      values,
      config.allowPrivateDestinations,
      seenSlugs,
      { checkSlugTaken: false },
    );
    if (errors.length) {
      results.push({ row: item.row, status: 'error', error: errors[0] });
      continue;
    }

    const fields = valuesToCreateFields(values);
    try {
      const link = await createLink({
        workspaceId,
        createdBy: user.id,
        destinationUrl: fields.destinationUrl,
        title: fields.title,
        slug: fields.slug,
        utmSource: fields.utmSource,
        utmMedium: fields.utmMedium,
        utmCampaign: fields.utmCampaign,
        utmTerm: fields.utmTerm,
        utmContent: fields.utmContent,
        startsAt: fields.startsAt,
        expiresAt: fields.expiresAt,
        importId: body.importId,
        importRow: item.row,
      });
      if (fields.tags.length)
        await setLinkTags(link.id, workspaceId, fields.tags);
      await writeAuditEvent('link_created', { slug: link.slug }, { workspaceId, actor: user.id, linkId: link.id });
      results.push({ row: item.row, status: 'created', linkId: link.id });
    }
    catch (error) {
      if (error instanceof AlreadyImportedError) {
        results.push({ row: item.row, status: 'already_imported', linkId: error.linkId });
        continue;
      }
      if (error instanceof SlugTakenError) {
        results.push({ row: item.row, status: 'conflict', error: 'This short link is already taken.' });
        continue;
      }
      if (error instanceof SlugExhaustedError) {
        results.push({ row: item.row, status: 'error', error: 'Could not generate a slug.' });
        continue;
      }
      results.push({ row: item.row, status: 'error', error: 'Could not create link.' });
    }
  }

  return { results };
});
