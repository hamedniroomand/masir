import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { count, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents, workspaceMembers } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import {
  e2eSetupOptions,
  insertTestLink,
  insertTestUser,
  insertTestWorkspace,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('links-preview');
const VIEWER_EMAIL = 'viewer-preview@example.com';
const OUTSIDER_EMAIL = 'outsider-preview@example.com';

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

describe('link routing preview', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';
  let ownerId = '';
  let oneTimeId = '';
  let protectedId = '';
  let targetedId = '';

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    ownerId = seeded.userId;

    oneTimeId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerId,
      slug: 'once-preview',
      destinationUrl: 'https://example.com/once',
      maximumVisits: 1,
      clickCount: 0,
    });

    protectedId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerId,
      slug: 'locked-preview',
      destinationUrl: 'https://example.com/secret',
      passwordHash: await hashSecret('gate-pass'),
    });

    targetedId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerId,
      slug: 'geo-preview',
      destinationUrl: 'https://example.com/default',
      targeting: {
        country: {
          US: 'https://example.com/us',
          DE: 'https://example.com/de',
        },
        os: { ios: 'https://example.com/ios' },
      },
    });

    const viewerId = await insertTestUser(TEST_DB, { email: VIEWER_EMAIL, password: TEST_PASSWORD });
    const outsiderId = await insertTestUser(TEST_DB, { email: OUTSIDER_EMAIL, password: TEST_PASSWORD });
    await insertTestWorkspace(TEST_DB, { slug: 'elsewhere', ownerUserId: outsiderId });

    const db = openTestDatabase(TEST_DB);
    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: viewerId,
      role: 'viewer',
    });
  });

  it('previews a one-time link without bumping clicks or events', async () => {
    const cookie = await loginCookie();
    const before = await readTestLink(TEST_DB, oneTimeId);
    const db = openTestDatabase(TEST_DB);
    const [eventsBefore] = await db.select({ n: count() }).from(clickEvents).where(eq(clickEvents.linkId, oneTimeId));

    const preview = await $fetch<{
      kind: string;
      destination?: string;
      rule: string | null;
      consumesVisit?: boolean;
    }>(`/api/links/${oneTimeId}/preview`, {
      method: 'POST',
      body: {},
      headers: { cookie },
    });

    expect(preview.kind).toBe('redirect');
    expect(preview.destination).toBe('https://example.com/once');
    expect(preview.rule).toBe('default');
    expect(preview.consumesVisit).toBe(true);

    const after = await readTestLink(TEST_DB, oneTimeId);
    expect(after.clickCount).toBe(before.clickCount);

    const [eventsAfter] = await db.select({ n: count() }).from(clickEvents).where(eq(clickEvents.linkId, oneTimeId));
    expect(eventsAfter!.n).toBe(eventsBefore!.n);
  });

  it('creates no password cookie for a protected link preview', async () => {
    const cookie = await loginCookie();
    const res = await fetch(`/api/links/${protectedId}/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { kind: string };
    expect(body.kind).toBe('password');

    const setCookie = res.headers.getSetCookie?.() ?? [];
    const raw = res.headers.get('set-cookie') ?? '';
    const all = [...setCookie, raw].join('\n');
    expect(all).not.toMatch(/ms_pwd_/);
  });

  it('matches a country rule from the preview body', async () => {
    const cookie = await loginCookie();
    const us = await $fetch<{ kind: string; destination?: string; rule: string | null }>(
      `/api/links/${targetedId}/preview`,
      { method: 'POST', body: { country: 'US', os: 'desktop' }, headers: { cookie } },
    );
    expect(us).toMatchObject({ kind: 'redirect', rule: 'country', destination: 'https://example.com/us' });

    const de = await $fetch<{ kind: string; destination?: string; rule: string | null }>(
      `/api/links/${targetedId}/preview`,
      { method: 'POST', body: { country: 'DE', os: 'ios' }, headers: { cookie } },
    );
    expect(de).toMatchObject({ kind: 'redirect', rule: 'country', destination: 'https://example.com/de' });

    const ios = await $fetch<{ kind: string; destination?: string; rule: string | null }>(
      `/api/links/${targetedId}/preview`,
      { method: 'POST', body: { os: 'ios' }, headers: { cookie } },
    );
    expect(ios).toMatchObject({ kind: 'redirect', rule: 'os', destination: 'https://example.com/ios' });
  });

  it('lets a viewer preview and refuses an outsider with 404', async () => {
    const viewerCookie = await loginCookie(VIEWER_EMAIL, TEST_PASSWORD);
    await expect($fetch(`/api/links/${targetedId}/preview`, {
      method: 'POST',
      body: { country: 'US' },
      headers: { cookie: viewerCookie },
    })).resolves.toMatchObject({ kind: 'redirect', rule: 'country' });

    const outsiderCookie = await loginCookie(OUTSIDER_EMAIL, TEST_PASSWORD);
    await expect($fetch(`/api/links/${targetedId}/preview`, {
      method: 'POST',
      body: {},
      headers: { cookie: outsiderCookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
