import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { linkTags, tags, workspaceMembers } from '#server/database/schema';
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

const TEST_DB = testDatabaseUrl('workspace-isolation');
const OUTSIDER = 'outsider@example.com';
const SHARED_TAG = 'shared';

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

describe('workspace isolation', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let linkInB = '';
  let ownerOfA = '';
  let memberOfB = '';

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    ownerOfA = seeded.userId;
    const workspaceB = await insertTestWorkspace(TEST_DB, { slug: 'apple', ownerUserId: seeded.userId });
    linkInB = await insertTestLink(TEST_DB, {
      workspaceId: workspaceB,
      createdBy: seeded.userId,
      slug: 'secret',
      destinationUrl: 'https://b.example.com/target',
    });

    memberOfB = await insertTestUser(TEST_DB, { email: OUTSIDER, password: TEST_PASSWORD });
    const db = openTestDatabase(TEST_DB);
    await db.insert(workspaceMembers).values({
      workspaceId: workspaceB,
      userId: memberOfB,
      role: 'member',
    });

    const [tagInB] = await db.insert(tags).values({
      workspaceId: workspaceB,
      name: SHARED_TAG,
      normalizedName: SHARED_TAG,
    }).returning();
    await db.insert(linkTags).values({
      workspaceId: workspaceB,
      linkId: linkInB,
      tagId: tagInB!.id,
    });
  });

  it('refuses to read another workspace link by id', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/links/${linkInB}`, { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('refuses to edit another workspace link by id', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/links/${linkInB}`, {
      method: 'PATCH',
      body: { title: 'stolen' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses to delete another workspace link by id', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/links/${linkInB}`, { method: 'DELETE', headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('leaves the other workspace link in place', async () => {
    const link = await readTestLink(TEST_DB, linkInB);
    expect(link.title).toBeNull();
  });

  it('does not list another workspace link', async () => {
    const cookie = await loginCookie();
    const page = await $fetch<{ items: { id: string }[] }>('/api/links', { headers: { cookie } });
    expect(page.items.map(i => i.id)).not.toContain(linkInB);
  });

  it('lets two workspaces hold the same slug', async () => {
    const cookie = await loginCookie();
    const created = await $fetch<{ slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://a.example.com/target', slug: 'secret' },
      headers: { cookie },
    });
    expect(created.slug).toBe('secret');
  });

  it('refuses to act on a member of another workspace by user id', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${memberOfB}`, {
      method: 'PATCH',
      body: { isActive: false },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a member of another workspace the member controls', async () => {
    const cookie = await loginCookie(OUTSIDER, TEST_PASSWORD);
    await expect($fetch(`/api/workspaces/members/${ownerOfA}`, {
      method: 'DELETE',
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('never matches another workspace link through a tag filter', async () => {
    const cookie = await loginCookie();
    const page = await $fetch<{ items: { id: string }[]; total: number }>('/api/links', {
      query: { tags: SHARED_TAG },
      headers: { cookie },
    });
    expect(page.items.map(i => i.id)).not.toContain(linkInB);
    expect(page.total).toBe(0);
  });

  it('refuses the link history of another workspace', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/links/${linkInB}/history`, { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('scopes the audit event list to the caller workspace', async () => {
    const cookie = await loginCookie();
    const body = await $fetch('/api/admin/audit-events', { headers: { cookie } });
    expect(JSON.stringify(body)).not.toContain(linkInB);
  });
});
