import type { LinkImportColumn, LinkImportValues } from '#shared/link-import';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { linkImports } from '#server/database/schema';
import { getDb, isUniqueViolation } from '#server/utils/db';
import { isSlugTaken } from '#server/utils/link-repo';
import { validateDestination } from '#server/utils/url';
import { uuidV5 } from '#server/utils/uuid-v5';
import { parseCsv } from '#shared/csv';
import {
  emptyImportValues,
  LINK_IMPORT_COLUMNS,
  LINK_IMPORT_MAX_BYTES,
  LINK_IMPORT_MAX_ROWS,
  LINK_IMPORT_TAG_SEPARATOR,

  parseImportDate,
  splitImportTags,
  unescapeCsvFormula,
} from '#shared/link-import';
import { MAX_TAGS_PER_LINK, tagNameSchema } from '#shared/link-input';
import { slugSchema } from '#shared/slug';
import { emptyToNull, utmValueSchema } from '#shared/utm';

export type PreviewRow = {
  row: number;
  values: LinkImportValues;
  errors: string[];
};

export type ParsedImport = {
  importId: string;
  fileHash: Uint8Array;
  rowCount: number;
  rows: PreviewRow[];
};

function hashFile(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest();
}

export function importIdFor(workspaceId: string, fileHash: Uint8Array) {
  return uuidV5(workspaceId, fileHash);
}

function mapHeader(headerRow: string[]): Map<LinkImportColumn, number> {
  const map = new Map<LinkImportColumn, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const name = (headerRow[i] ?? '').trim().toLowerCase() as LinkImportColumn;
    if ((LINK_IMPORT_COLUMNS as readonly string[]).includes(name) && !map.has(name))
      map.set(name, i);
  }
  return map;
}

function cellAt(row: string[], index: number | undefined): string {
  if (index == null)
    return '';
  return unescapeCsvFormula((row[index] ?? '').trim());
}

export async function validateImportValues(
  workspaceId: string,
  values: LinkImportValues,
  allowPrivate: boolean,
  seenSlugs: Set<string>,
  options: { checkSlugTaken?: boolean } = {},
): Promise<string[]> {
  const checkSlugTaken = options.checkSlugTaken !== false;
  const errors: string[] = [];

  if (!values.destination_url) {
    errors.push('Enter a destination URL.');
  }
  else {
    const dest = validateDestination(values.destination_url, allowPrivate);
    if (!dest.ok)
      errors.push(dest.reason);
    else
      values.destination_url = dest.url;
  }

  if (values.slug) {
    const parsed = v.safeParse(slugSchema, values.slug);
    if (!parsed.success) {
      errors.push(parsed.issues[0]?.message ?? 'Invalid slug.');
    }
    else {
      values.slug = parsed.output;
      if (seenSlugs.has(values.slug))
        errors.push('This short link is already taken.');
      else if (checkSlugTaken && await isSlugTaken(workspaceId, values.slug))
        errors.push('This short link is already taken.');
      else
        seenSlugs.add(values.slug);
    }
  }

  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
    const raw = values[key];
    if (!raw)
      continue;
    const parsed = v.safeParse(utmValueSchema, raw);
    if (!parsed.success)
      errors.push(parsed.issues[0]?.message ?? `Invalid ${key}.`);
    else
      values[key] = parsed.output;
  }

  const tags = splitImportTags(values.tags);
  if (tags.length > MAX_TAGS_PER_LINK)
    errors.push(`Use at most ${MAX_TAGS_PER_LINK} tags for a link.`);
  for (const tag of tags) {
    const parsed = v.safeParse(tagNameSchema, tag);
    if (!parsed.success) {
      errors.push(parsed.issues[0]?.message ?? 'Invalid tag.');
      break;
    }
  }
  values.tags = tags.join(LINK_IMPORT_TAG_SEPARATOR);

  const starts = parseImportDate(values.starts_at);
  if (!starts.ok)
    errors.push(starts.error);
  const expires = parseImportDate(values.expires_at);
  if (!expires.ok)
    errors.push(expires.error);
  if (starts.ok && expires.ok && starts.date && expires.date && starts.date.getTime() >= expires.date.getTime())
    errors.push('Start time must be before expiry.');

  return errors;
}

export async function parseImportCsv(
  workspaceId: string,
  bytes: Uint8Array,
  allowPrivate: boolean,
): Promise<ParsedImport> {
  if (bytes.byteLength > LINK_IMPORT_MAX_BYTES)
    throw createError({ statusCode: 422, statusMessage: `CSV must be at most ${LINK_IMPORT_MAX_BYTES} bytes.`, data: { reason: `CSV must be at most ${LINK_IMPORT_MAX_BYTES} bytes.` } });

  const text = new TextDecoder('utf-8').decode(bytes);
  const table = parseCsv(text);
  if (!table.length)
    throw createError({ statusCode: 422, statusMessage: 'CSV needs a header row.', data: { reason: 'CSV needs a header row.' } });

  const header = table[0];
  if (!header)
    throw createError({ statusCode: 422, statusMessage: 'CSV needs a header row.', data: { reason: 'CSV needs a header row.' } });
  const columns = mapHeader(header);
  if (!columns.has('destination_url'))
    throw createError({ statusCode: 422, statusMessage: 'CSV needs a destination_url column.', data: { reason: 'CSV needs a destination_url column.' } });

  const dataRows = table.slice(1);
  if (dataRows.length > LINK_IMPORT_MAX_ROWS) {
    throw createError({
      statusCode: 422,
      statusMessage: `CSV holds at most ${LINK_IMPORT_MAX_ROWS} rows.`,
      data: { reason: `CSV holds at most ${LINK_IMPORT_MAX_ROWS} rows.` },
    });
  }

  const fileHash = hashFile(bytes);
  const importId = importIdFor(workspaceId, fileHash);
  const seenSlugs = new Set<string>();
  const rows: PreviewRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i] ?? [];
    const values = emptyImportValues();
    for (const column of LINK_IMPORT_COLUMNS)
      values[column] = cellAt(raw, columns.get(column));
    const errors = await validateImportValues(workspaceId, values, allowPrivate, seenSlugs);
    rows.push({ row: i + 1, values, errors });
  }

  return { importId, fileHash, rowCount: rows.length, rows };
}

export async function ensureLinkImport(input: {
  importId: string;
  workspaceId: string;
  createdBy: string;
  fileHash: Uint8Array;
  rowCount: number;
}) {
  const db = await getDb();
  const existing = await db.select({ id: linkImports.id }).from(linkImports).where(eq(linkImports.id, input.importId)).limit(1);
  if (existing[0])
    return;

  try {
    await db.insert(linkImports).values({
      id: input.importId,
      workspaceId: input.workspaceId,
      createdBy: input.createdBy,
      fileHash: input.fileHash,
      rowCount: input.rowCount,
    });
  }
  catch (error) {
    if (isUniqueViolation(error))
      return;
    throw error;
  }
}

export function valuesToCreateFields(values: LinkImportValues) {
  const starts = parseImportDate(values.starts_at);
  const expires = parseImportDate(values.expires_at);
  return {
    destinationUrl: values.destination_url,
    slug: values.slug || undefined,
    title: emptyToNull(values.title),
    utmSource: emptyToNull(values.utm_source),
    utmMedium: emptyToNull(values.utm_medium),
    utmCampaign: emptyToNull(values.utm_campaign),
    utmTerm: emptyToNull(values.utm_term),
    utmContent: emptyToNull(values.utm_content),
    startsAt: starts.ok ? starts.date : null,
    expiresAt: expires.ok ? expires.date : null,
    tags: splitImportTags(values.tags),
  };
}
