import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { workspaces } from '#server/database/schema';
import { DEMO_LINK_CAP, SEED_LINKS } from '#server/utils/demo';
import { e2eSetupOptions, insertTestLink, insertTestUser, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('demo_limits');

let cookie = '';
let workspaceId = '';
let memberId = '';

async function loginCookie() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

describe('demo limits', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    memberId = await insertTestUser(TEST_DB, { email: 'member@example.com', password: TEST_PASSWORD });
    const db = openTestDatabase(TEST_DB);
    await db.update(workspaces).set({ expiresAt: new Date(Date.now() + 3_600_000) }).where(eq(workspaces.id, workspaceId));
    cookie = await loginCookie();
  });

  it('answers 404 on the demo route when the gate is off', async () => {
    await expect($fetch('/api/auth/demo', { method: 'POST', body: {} })).rejects.toMatchObject({ statusCode: 404 });
  });

  // The seeded links count toward the cap, so the visitor still adds five.
  it('leaves room for five visitor links beside the seeded ones', async () => {
    for (const seed of SEED_LINKS)
      await insertTestLink(TEST_DB, { workspaceId, slug: seed.slug });

    for (let i = 0; i < 5; i++) {
      await $fetch('/api/links', {
        method: 'POST',
        body: { destinationUrl: `https://example.com/${i}` },
        headers: { cookie },
      });
    }
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/sixth' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403, data: { data: { reason: `The demo allows ${DEMO_LINK_CAP} links.` } } });
  });

  it('refuses invitations and ownership transfer in a demo workspace', async () => {
    await expect($fetch('/api/workspaces/invitations', {
      method: 'POST',
      body: { email: 'friend@example.com' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403 });
    await expect($fetch('/api/workspaces/transfer-ownership', {
      method: 'POST',
      body: { userId: memberId },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lifts every limit once the flag is cleared', async () => {
    const db = openTestDatabase(TEST_DB);
    await db.update(workspaces).set({ expiresAt: null }).where(eq(workspaces.id, workspaceId));
    const link = await $fetch<{ slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/free' },
      headers: { cookie },
    });
    expect(link.slug).toBeTruthy();
  });
});
