import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabasePath } from './helpers';

const TEST_DB = testDatabasePath('links');

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

describe('links API', async () => {
  await setup(e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('creates a link with only destinationUrl', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ slug: string; shortUrl: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/page' },
      headers: { cookie },
    });
    expect(link.slug).toMatch(/^[a-z0-9-]{7,}$/);
    expect(link.shortUrl).toContain(`/${link.slug}`);
  });

  it('renders the link detail page with the tracking card', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/detail', utmSource: 'newsletter' },
      headers: { cookie },
    });
    const html = await $fetch<string>(`/links/${link.id}`, { responseType: 'text', headers: { cookie } });
    expect(html).toContain('Campaign and tracking');
    expect(html).toContain('utm_source=newsletter');
  });

  it('rejects javascript destinations with 422', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'javascript:alert(1)' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
