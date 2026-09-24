import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { and, eq, isNull } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { links, linkTags, tags } from '#server/database/schema';
import { parseCsv, toCsv } from '#shared/csv';
import {
  e2eSetupOptions,
  insertTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('links-import');

async function loginCookie(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

function csvFile(text: string, name = 'links.csv') {
  return new File([text], name, { type: 'text/csv' });
}

async function preview(cookie: string, text: string) {
  const body = new FormData();
  body.set('file', csvFile(text));
  return $fetch<{
    importId: string;
    fileHash: string;
    rowCount: number;
    rows: { row: number; values: Record<string, string>; errors: string[] }[];
  }>('/api/links/import/preview', {
    method: 'POST',
    body,
    headers: { cookie },
  });
}

async function runImport(
  cookie: string,
  payload: { importId: string; fileHash: string; rows: { row: number; values: Record<string, string> }[] },
) {
  return $fetch<{
    results: { row: number; status: string; linkId?: string; error?: string }[];
  }>('/api/links/import', {
    method: 'POST',
    body: payload,
    headers: { cookie },
  });
}

describe('links CSV import and export', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';
  let userId = '';

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    userId = seeded.userId;
  });

  it('preview marks invalid URL, duplicate slug, and reserved slug; import creates the others', async () => {
    const cookie = await loginCookie();
    await insertTestLink(TEST_DB, { workspaceId, createdBy: userId, slug: 'taken-slug' });

    const csv = [
      'slug,destination_url,title,tags',
      'ok-one,https://example.com/one,One,alpha|beta',
      'bad-url,not-a-url,Bad,',
      'taken-slug,https://example.com/dup,Dup,',
      'login,https://example.com/reserved,Reserved,',
      'ok-two,https://example.com/two,Two,',
    ].join('\n');

    const previewed = await preview(cookie, csv);
    expect(previewed.rowCount).toBe(5);

    const byRow = new Map(previewed.rows.map(row => [row.row, row]));
    expect(byRow.get(1)?.errors).toEqual([]);
    expect(byRow.get(2)?.errors.some(error => /url|valid/i.test(error))).toBe(true);
    expect(byRow.get(3)?.errors).toContain('This short link is already taken.');
    expect(byRow.get(4)?.errors).toContain('This slug is reserved.');
    expect(byRow.get(5)?.errors).toEqual([]);

    const valid = previewed.rows.filter(row => row.errors.length === 0);
    const imported = await runImport(cookie, {
      importId: previewed.importId,
      fileHash: previewed.fileHash,
      rows: valid.map(row => ({ row: row.row, values: row.values })),
    });

    expect(imported.results).toHaveLength(2);
    expect(imported.results.every(row => row.status === 'created')).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const created = await db.select().from(links).where(and(
      eq(links.workspaceId, workspaceId),
      eq(links.importId, previewed.importId),
      isNull(links.deletedAt),
    ));
    expect(created).toHaveLength(2);
    expect(created.map(row => row.slug).sort()).toEqual(['ok-one', 'ok-two']);

    const tagged = created.find(row => row.slug === 'ok-one')!;
    const tagRows = await db.select({ name: tags.name })
      .from(linkTags)
      .innerJoin(tags, eq(linkTags.tagId, tags.id))
      .where(eq(linkTags.linkId, tagged.id));
    expect(tagRows.map(row => row.name).sort()).toEqual(['alpha', 'beta']);
  });

  it('re-importing the same file reports already_imported and creates nothing', async () => {
    const cookie = await loginCookie();
    const csv = [
      'slug,destination_url,title',
      'idem-a,https://example.com/a,A',
      'idem-b,https://example.com/b,B',
    ].join('\n');

    const firstPreview = await preview(cookie, csv);
    const first = await runImport(cookie, {
      importId: firstPreview.importId,
      fileHash: firstPreview.fileHash,
      rows: firstPreview.rows.map(row => ({ row: row.row, values: row.values })),
    });
    expect(first.results.every(row => row.status === 'created')).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const before = await db.select().from(links).where(eq(links.importId, firstPreview.importId));

    const secondPreview = await preview(cookie, csv);
    expect(secondPreview.importId).toBe(firstPreview.importId);

    const second = await runImport(cookie, {
      importId: secondPreview.importId,
      fileHash: secondPreview.fileHash,
      rows: secondPreview.rows.map(row => ({ row: row.row, values: row.values })),
    });
    expect(second.results).toHaveLength(2);
    expect(second.results.every(row => row.status === 'already_imported')).toBe(true);

    const after = await db.select().from(links).where(eq(links.importId, firstPreview.importId));
    expect(after).toHaveLength(before.length);
  });

  it('export then import into an empty workspace reproduces supported fields', async () => {
    const cookie = await loginCookie();
    const startsAt = new Date('2026-06-01T12:00:00.000Z');
    const expiresAt = new Date('2026-12-01T12:00:00.000Z');

    const sourceId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: userId,
      slug: 'round-trip',
      title: 'Round Trip',
      destinationUrl: 'https://example.com/round-trip',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmContent: 'hero',
      startsAt,
      expiresAt,
      clickCount: 7,
    });

    const db = openTestDatabase(TEST_DB);
    const [tag] = await db.insert(tags).values({
      workspaceId,
      name: 'export',
      normalizedName: 'export',
    }).returning();
    await db.insert(linkTags).values({ workspaceId, linkId: sourceId, tagId: tag!.id });
    await db.update(links).set({ utmCampaign: 'spring', utmTerm: 'shoes' }).where(eq(links.id, sourceId));

    const exported = await $fetch<string>('/api/links/export.csv', {
      query: { q: 'round-trip' },
      headers: { cookie },
      responseType: 'text',
    });

    const table = parseCsv(exported);
    expect(table[0]).toContain('lifetime_clicks');
    expect(table[0]).toContain('notes');
    expect(table.some(row => row.includes('round-trip'))).toBe(true);

    // Single-workspace test servers always resolve one workspace. Remove the
    // source row so the import lands in an empty library with a free slug.
    await db.delete(linkTags).where(eq(linkTags.linkId, sourceId));
    await db.delete(links).where(eq(links.id, sourceId));

    const header = table[0]!;
    const keep = ['slug', 'destination_url', 'title', 'tags', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'starts_at', 'expires_at'];
    const indexes = keep.map(name => header.indexOf(name));
    const importCsv = toCsv([
      keep,
      ...table.slice(1).filter(row => row[header.indexOf('slug')] === 'round-trip').map(row => indexes.map(index => row[index] ?? '')),
    ]);

    const previewed = await preview(cookie, importCsv);
    expect(previewed.rows[0]?.errors).toEqual([]);
    const imported = await runImport(cookie, {
      importId: previewed.importId,
      fileHash: previewed.fileHash,
      rows: previewed.rows.map(row => ({ row: row.row, values: row.values })),
    });
    expect(imported.results[0]?.status).toBe('created');

    const [target] = await db.select().from(links).where(eq(links.slug, 'round-trip')).limit(1);
    expect(target).toBeTruthy();
    expect(target!.title).toBe('Round Trip');
    expect(target!.destinationUrl).toBe('https://example.com/round-trip');
    expect(target!.utmSource).toBe('newsletter');
    expect(target!.utmMedium).toBe('email');
    expect(target!.utmCampaign).toBe('spring');
    expect(target!.utmTerm).toBe('shoes');
    expect(target!.utmContent).toBe('hero');
    expect(target!.startsAt?.toISOString()).toBe(startsAt.toISOString());
    expect(target!.expiresAt?.toISOString()).toBe(expiresAt.toISOString());

    const targetTags = await db.select({ name: tags.name })
      .from(linkTags)
      .innerJoin(tags, eq(linkTags.tagId, tags.id))
      .where(eq(linkTags.linkId, target!.id));
    expect(targetTags.map(row => row.name)).toEqual(['export']);
  });

  it('prefixes a formula-like cell in the export', async () => {
    const cookie = await loginCookie();
    await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: userId,
      slug: 'formula-row',
      title: '=1+1',
      destinationUrl: 'https://example.com/formula',
    });

    const exported = await $fetch<string>('/api/links/export.csv', {
      query: { q: 'formula-row' },
      headers: { cookie },
      responseType: 'text',
    });

    expect(exported).toContain('\'=1+1');
  });
});
