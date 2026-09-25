import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '#server/database/migrate';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';

const TEST_DB = testDatabaseUrl('compat_addresses');

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

describe('published addresses compatibility across migrations [R1 exit]', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('preserves resolution for primary links, aliases, and retained prefixes after running migrations', async () => {
    const cookie = await loginCookie();

    // 1. Create a root link and alias before prefixing
    const rootLink = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/dest-root', slug: 'root-link' },
      headers: { cookie },
    });

    await $fetch(`/api/links/${rootLink.id}/aliases`, {
      method: 'POST',
      body: { slug: 'root-alias' },
      headers: { cookie },
    });

    // 2. Set an initial workspace prefix
    await $fetch('/api/workspaces', {
      method: 'PATCH',
      body: { linkPrefix: 'v1-prefix', pathMode: 'preserve' },
      headers: { cookie },
    });

    // 3. Create a link under v1-prefix
    const teamLink = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/dest-team', slug: 'team-link' },
      headers: { cookie },
    });

    await $fetch(`/api/links/${teamLink.id}/aliases`, {
      method: 'POST',
      body: { slug: 'team-alias' },
      headers: { cookie },
    });

    // 4. Update workspace prefix to v2-prefix with preserve mode
    await $fetch('/api/workspaces', {
      method: 'PATCH',
      body: { linkPrefix: 'v2-prefix', pathMode: 'preserve' },
      headers: { cookie },
    });

    // 5. Execute migrations to simulate upgrade to current schema
    await runMigrations(TEST_DB);

    // 6. Assert every published address answers the same 302 redirect
    const addresses = [
      { path: '/v2-prefix/team-link', expected: 'https://example.com/dest-team' },
      { path: '/v1-prefix/team-link', expected: 'https://example.com/dest-team' },
      { path: '/v2-prefix/team-alias', expected: 'https://example.com/dest-team' },
      { path: '/v1-prefix/team-alias', expected: 'https://example.com/dest-team' },
      { path: '/v2-prefix/root-link', expected: 'https://example.com/dest-root' },
      { path: '/v1-prefix/root-link', expected: 'https://example.com/dest-root' },
      { path: '/v2-prefix/root-alias', expected: 'https://example.com/dest-root' },
      { path: '/v1-prefix/root-alias', expected: 'https://example.com/dest-root' },
    ];

    for (const address of addresses) {
      const response = await fetch(address.path, { redirect: 'manual' });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(address.expected);
    }
  });
});
