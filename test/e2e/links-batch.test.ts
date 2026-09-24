import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, insertTestCampaign, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';

const TEST_DB = testDatabaseUrl('links-batch');

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

describe('links batch API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId: string;

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
  });

  it('creates three channel links in one request', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'batch-test', utmMedium: 'email' });
    const res = await $fetch<{ results: { clientKey: string; status: string; link?: { slug: string; utmSource: string | null } }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/page',
        title: 'Batch',
        items: [
          { clientKey: 'newsletter', utmSource: 'newsletter', utmMedium: 'email' },
          { clientKey: 'social', utmSource: 'twitter', utmMedium: 'social' },
          { clientKey: 'print', utmSource: 'print', utmMedium: 'print' },
        ],
      },
      headers: { cookie },
    });

    expect(res.results).toHaveLength(3);
    for (const r of res.results)
      expect(r.status).toBe('created');
    const sources = res.results.map(r => r.link?.utmSource);
    expect(sources).toEqual(['newsletter', 'twitter', 'print']);
  });

  it('refuses the whole batch when one slug is taken', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'dup-test' });
    await $fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/existing', slug: 'taken-slug' },
      headers: { cookie },
    });

    const res = await $fetch<{ rows?: { clientKey: string; error: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/dup',
        items: [
          { clientKey: 'ok', utmSource: 'a' },
          { clientKey: 'dup', utmSource: 'b', slug: 'taken-slug' },
        ],
      },
      headers: { cookie },
    }).catch((e: unknown) => e as { statusCode?: number; data?: { data?: { rows?: { clientKey: string; error: string }[] } } });

    expect((res as { data?: { statusCode?: number } }).data?.statusCode).toBe(422);
    const rows = (res as { data?: { data?: { rows?: { clientKey: string; error: string }[] } } }).data?.data?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientKey).toBe('dup');
  });

  it('returns created rows on a retry of only the failed items', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'retry-test' });
    const res = await $fetch<{ results: { clientKey: string; status: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/retry',
        items: [
          { clientKey: 'first', utmSource: 'first' },
          { clientKey: 'second', utmSource: 'second' },
        ],
      },
      headers: { cookie },
    });
    expect(res.results.every(r => r.status === 'created')).toBe(true);

    const retry = await $fetch<{ results: { clientKey: string; status: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/retry',
        items: [{ clientKey: 'second', utmSource: 'second' }],
      },
      headers: { cookie },
    });
    expect(retry.results).toHaveLength(1);
    expect(retry.results[0]?.status).toBe('created');
  });

  it('refuses more than 20 items', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links/batch', {
      method: 'POST',
      body: {
        destinationUrl: 'https://example.com/big',
        items: Array.from({ length: 21 }, (_, i) => ({ clientKey: `k${i}`, utmSource: 'x' })),
      },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
