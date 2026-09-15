import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabasePath } from './helpers';

const TEST_DB = testDatabasePath('link-history');

async function loginCookie() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

describe('link history API', async () => {
  await setup(e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('records who created a link and what each edit changed', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/one' },
      headers: { cookie },
    });

    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { destinationUrl: 'https://example.com/two', title: 'Renamed' },
      headers: { cookie },
    });

    const history = await $fetch<{ items: { type: string; actorName: string | null; fields: string[] | null }[] }>(
      `/api/links/${link.id}/history`,
      { headers: { cookie } },
    );

    expect(history.items.map(i => i.type)).toEqual(['link_updated', 'link_created']);
    expect(history.items.every(i => i.actorName === 'Test User')).toBe(true);
    expect(history.items[0]!.fields).toEqual(expect.arrayContaining(['destinationUrl', 'title']));
  });

  it('refuses history for a link owned by someone else', async () => {
    await expect($fetch('/api/links/does-not-exist/history')).rejects.toMatchObject({ statusCode: 401 });
  });
});
