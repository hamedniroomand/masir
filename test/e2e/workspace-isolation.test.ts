import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  e2eSetupOptions,
  insertTestLink,
  insertTestWorkspace,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';

const TEST_DB = testDatabaseUrl('workspace-isolation');

async function loginCookie() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

describe('workspace isolation', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let linkInB = '';

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    const workspaceB = await insertTestWorkspace(TEST_DB, { slug: 'apple', ownerUserId: seeded.userId });
    linkInB = await insertTestLink(TEST_DB, {
      workspaceId: workspaceB,
      createdByUserId: seeded.userId,
      slug: 'secret',
      destinationUrl: 'https://b.example.com/target',
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
});
