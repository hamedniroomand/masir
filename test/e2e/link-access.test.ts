import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CHROME_UA,
  e2eSetupOptions,
  insertTestLink,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';

function humanFetch(path: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      'user-agent': CHROME_UA,
    },
  });
}

const TEST_DB = testDatabaseUrl('link-access');

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

describe('link access controls', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
  });

  it('blocks a link before start and allows it at start', async () => {
    const start = new Date(Date.now() + 60_000);
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'schedule-window',
      startsAt: start,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const before = await fetch('/schedule-window', {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0' },
    });
    expect(before.status).toBe(404);
    const beforeBody = await before.json() as { data?: { linkState?: string; startsAt?: string } };
    expect(beforeBody.data?.linkState).toBe('scheduled');
    expect(beforeBody.data?.startsAt).toBeTruthy();

    const rowBefore = await readTestLink(TEST_DB, linkId);
    expect(rowBefore.clickCount).toBe(0);

    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'schedule-open',
      startsAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const open = await humanFetch('/schedule-open', { redirect: 'manual' });
    expect(open.status).toBe(302);
  });

  it('shows activation time on the visitor error page', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'schedule-page',
      startsAt: new Date(Date.now() + 86400_000),
    });
    const pageRes = await fetch('/schedule-page', {
      headers: { accept: 'text/html', 'user-agent': CHROME_UA },
    });
    expect(pageRes.status).toBe(404);
    const html = await pageRes.text();
    expect(html).toContain('This link is not available yet');
    expect(html).toContain('Opens');
  });

  it('enforces maximum visits including parallel requests', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'visit-cap',
      maximumVisits: 10,
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => humanFetch('/visit-cap', { redirect: 'manual' })),
    );
    expect(results.filter(r => r.status === 302).length).toBe(10);
    expect(results.filter(r => r.status === 404).length).toBe(10);

    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'one-time',
      maximumVisits: 1,
    });
    const first = await humanFetch('/one-time', { redirect: 'manual' });
    const second = await humanFetch('/one-time', { redirect: 'manual' });
    expect(first.status).toBe(302);
    expect(second.status).toBe(404);
  });

  it('does not consume a visit for a bot', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'bot-skip',
      maximumVisits: 1,
    });
    await fetch('/bot-skip', {
      redirect: 'manual',
      headers: { 'user-agent': 'Googlebot/2.1' },
    });
    const row = await readTestLink(TEST_DB, linkId);
    expect(row.clickCount).toBe(0);
  });

  it('redirects expired links to a custom destination without counting a click', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'expired-fallback',
      expiresAt: new Date(Date.now() - 1000),
      expirationDestination: 'https://example.com/expired-landing',
    });
    const rowBefore = await readTestLink(TEST_DB, linkId);
    const res = await humanFetch('/expired-fallback', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/expired-landing');
    const rowAfter = await readTestLink(TEST_DB, linkId);
    expect(rowAfter.clickCount).toBe(rowBefore.clickCount);
  });

  it('shows the default expired page when no fallback is set', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'expired-default',
      expiresAt: new Date(Date.now() - 1000),
    });
    const body = await fetch('/expired-default', { headers: { accept: 'application/json' } }).then(r => r.json()) as { data?: { linkState?: string } };
    expect(body.data?.linkState).toBe('expired');
  });

  it('rejects unsafe and loop expiration destinations on patch', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/live' },
      headers: { cookie },
    });

    await expect($fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { expirationDestination: 'javascript:alert(1)' },
    })).rejects.toMatchObject({ statusCode: 422 });

    await expect($fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { expirationDestination: `http://127.0.0.1:3000/${link.slug}` },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects maximum visits below the used count', async () => {
    const cookie = await loginCookie();
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'patch-cap',
      maximumVisits: 10,
      clickCount: 3,
    });
    await expect($fetch(`/api/links/${linkId}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { maximumVisits: 2 },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a maximum visit value that is not a whole number above zero', async () => {
    const cookie = await loginCookie();
    for (const maximumVisits of [0, -1, 2.5]) {
      await expect($fetch('/api/links', {
        method: 'POST',
        headers: { cookie },
        body: { destinationUrl: 'https://example.com/limit', maximumVisits },
      })).rejects.toMatchObject({ statusCode: 422 });
    }
  });

  it('removes a visit limit when the value is null', async () => {
    const cookie = await loginCookie();
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'clear-cap',
      maximumVisits: 5,
      clickCount: 5,
    });
    const updated = await $fetch<{ maximumVisits: number | null; status: string }>(`/api/links/${linkId}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { maximumVisits: null },
    });
    expect(updated.maximumVisits).toBe(null);
    expect(updated.status).toBe('active');
  });

  it('rejects a loop expiration destination on create', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links', {
      method: 'POST',
      headers: { cookie },
      body: {
        destinationUrl: 'https://example.com/live',
        slug: 'loop-create',
        expirationDestination: 'http://127.0.0.1:3000/loop-create',
      },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
