import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, insertTestLink, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';

const TEST_DB = testDatabaseUrl('links');

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
  await setup(await e2eSetupOptions(TEST_DB));

  let userId = '';

  beforeAll(async () => {
    ({ userId } = await resetTestDb(TEST_DB));
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

  it('deletes a link and reserves its slug', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/gone' },
      headers: { cookie },
    });
    await $fetch(`/api/links/${link.id}`, { method: 'DELETE', headers: { cookie } });

    await expect($fetch(`/api/links/${link.id}`, { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/again', slug: link.slug },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not expose passwordHash in API responses', async () => {
    const cookie = await loginCookie();
    const linkId = await insertTestLink(TEST_DB, {
      userId,
      slug: 'protected-link',
      passwordHash: 'hashed-secret',
    });
    const link = await $fetch<Record<string, unknown>>(`/api/links/${linkId}`, { headers: { cookie } });
    expect(link).not.toHaveProperty('passwordHash');
    expect(link.isProtected).toBe(true);
    expect(link.successfulVisitCount).toBe(0);
    expect(link.startsAt).toBeNull();
    expect(link.maximumVisits).toBeNull();
  });

  it('rejects start time after expiry with 422', async () => {
    const cookie = await loginCookie();
    const start = Date.now() + 86400_000;
    const end = Date.now() + 3600_000;
    await expect($fetch('/api/links', {
      method: 'POST',
      body: {
        destinationUrl: 'https://example.com/bad-schedule',
        startsAt: start,
        expiresAt: end,
      },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
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
