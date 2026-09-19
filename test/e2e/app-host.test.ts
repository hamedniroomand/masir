import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  e2eSetupOptions,
  insertTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';

const TEST_DB = testDatabaseUrl('app_host');

// Both names resolve to the same server. The hostname decides, not the port.
const ROOT = 'http://127.0.0.1:3000';
const APP = 'http://localhost:3000';

describe('app host split', async () => {
  const options = await e2eSetupOptions(TEST_DB, { NUXT_ROOT_DOMAIN: ROOT, NUXT_APP_DOMAIN: APP });
  await setup(options);
  const port = new URL(options.host).port;
  const appHost = `http://localhost:${port}`;

  let workspaceId = '';

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
  });

  async function appLoginCookie() {
    const res = await globalThis.fetch(`${appHost}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    return res.headers.get('set-cookie')!.split(';')[0]!;
  }

  it('serves an indexable landing page on the root', async () => {
    const res = await fetch('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag') ?? '').not.toContain('noindex');
    const html = await res.text();
    expect(html).toContain(`${APP}/login`);
  });

  it('reports the landing host', async () => {
    expect(await $fetch('/api/host')).toEqual({ landing: true, appUrl: APP, registration: true, demo: false });
    const res = await globalThis.fetch(`${appHost}/api/host`);
    expect(await res.json()).toEqual({ landing: false, appUrl: APP, registration: true, demo: false });
  });

  it('bounces an app page on the root to the app host', async () => {
    const res = await fetch('/login', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${APP}/login`);
  });

  it('still redirects a short link on the root', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'split-test', destinationUrl: 'https://example.com/split' });
    const res = await fetch('/split-test', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/split');
  });

  it('serves the app on the app host', async () => {
    const res = await globalThis.fetch(`${appHost}/login`, { redirect: 'manual' });
    expect(res.status).toBe(200);
  });

  // The links list stays a client-rendered page, so the server answers with
  // the app shell and the browser does the sign-in redirect.
  it('keeps the app host home client-only and unindexed', async () => {
    const res = await globalThis.fetch(`${appHost}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(await res.text()).not.toContain(`${APP}/register`);
  });

  it('points app links at the app host and short links at the root', async () => {
    const cookie = await appLoginCookie();
    const list = await (await globalThis.fetch(`${appHost}/api/workspaces`, { headers: { cookie } })).json() as { items: { url: string }[] };
    expect(list.items[0]?.url).toBe(APP);
    const res = await globalThis.fetch(`${appHost}/api/links`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ destinationUrl: 'https://example.com/page' }),
    });
    const link = await res.json() as { slug: string; shortUrl: string };
    expect(link.shortUrl).toBe(`${ROOT}/${link.slug}`);
  });
});
