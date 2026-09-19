import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  e2eSetupOptions,
  insertTestUser,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { truncateTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('link_prefix');

type WorkspaceDto = { id: string; slug: string; linkPrefix: string | null };

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

describe('link prefix', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let cookie = '';

  beforeAll(async () => {
    await truncateTestDatabase(TEST_DB);
    await insertTestUser(TEST_DB, { email: TEST_EMAIL, password: TEST_PASSWORD });
    cookie = await loginCookie();
  });

  it('stores the prefix given at creation', async () => {
    const workspace = await $fetch<WorkspaceDto>('/api/workspaces', {
      method: 'POST',
      body: { name: 'Acme', slug: 'acme', linkPrefix: '/Go/' },
      headers: { cookie },
    });
    expect(workspace.linkPrefix).toBe('go');
  });

  it('prints the prefix in every short url', async () => {
    const link = await $fetch<{ slug: string; shortUrl: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/page' },
      headers: { cookie },
    });
    expect(link.shortUrl).toMatch(new RegExp(`/go/${link.slug}$`));
  });

  it('lists the prefix with the workspace', async () => {
    const list = await $fetch<{ items: WorkspaceDto[] }>('/api/workspaces', { headers: { cookie } });
    expect(list.items[0]?.linkPrefix).toBe('go');
  });

  it('refuses a reserved prefix', async () => {
    await expect($fetch('/api/workspaces', {
      method: 'PATCH',
      body: { linkPrefix: 'api' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('clears the prefix with an empty value', async () => {
    const workspace = await $fetch<WorkspaceDto>('/api/workspaces', {
      method: 'PATCH',
      body: { linkPrefix: '' },
      headers: { cookie },
    });
    expect(workspace.linkPrefix).toBeNull();
    const link = await $fetch<{ slug: string; shortUrl: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/other' },
      headers: { cookie },
    });
    expect(link.shortUrl).not.toContain('/go/');
  });
});
