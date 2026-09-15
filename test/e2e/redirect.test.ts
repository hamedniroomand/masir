import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, insertTestLink, resetTestDb, testDatabasePath } from './helpers';

const TEST_DB = testDatabasePath('redirect');

describe('redirect middleware', async () => {
  await setup(e2eSetupOptions(TEST_DB));

  let userId: string;

  beforeAll(async () => {
    const { userId: id } = await resetTestDb(TEST_DB);
    userId = id;
  });

  it('redirects an active slug with 302', async () => {
    await insertTestLink(TEST_DB, { userId, slug: 'active-test', destinationUrl: 'https://example.com/here' });
    const res = await fetch('/active-test', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/here');
  });

  it('keeps an inbound query and passes it to the destination', async () => {
    await insertTestLink(TEST_DB, { userId, slug: 'query-test', destinationUrl: 'https://example.com/here?a=1' });
    const res = await fetch('/query-test?utm_source=newsletter', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/here?a=1&utm_source=newsletter');
  });

  it('returns 404 with disabled linkState', async () => {
    await insertTestLink(TEST_DB, { userId, slug: 'off-test', isEnabled: false });
    const res = await fetch('/off-test', { headers: { accept: 'application/json' } });
    expect(res.status).toBe(404);
    const body = await res.json() as { data?: { linkState?: string } };
    expect(body.data?.linkState).toBe('disabled');
  });

  it('returns 404 with expired linkState', async () => {
    await insertTestLink(TEST_DB, {
      userId,
      slug: 'old-test',
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await fetch('/old-test', { headers: { accept: 'application/json' } });
    expect(res.status).toBe(404);
    const body = await res.json() as { data?: { linkState?: string } };
    expect(body.data?.linkState).toBe('expired');
  });

  it('does not handle /login', async () => {
    const html = await $fetch<string>('/login', { responseType: 'text' });
    expect(html.toLowerCase()).toContain('sign in');
  });
});
