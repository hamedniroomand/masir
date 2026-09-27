import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CHROME_UA,
  e2eSetupOptions,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';

const TEST_DB = testDatabaseUrl('password');

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

describe('link password API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('sets, replaces, and removes a password without exposing the hash', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; isProtected: boolean }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/secret' },
      headers: { cookie },
    });
    expect(link.isProtected).toBe(false);

    const protectedLink = await $fetch<Record<string, unknown>>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: 'visitor-secret' },
    });
    expect(protectedLink.isProtected).toBe(true);
    expect(protectedLink).not.toHaveProperty('passwordHash');

    const replaced = await $fetch<{ isProtected: boolean }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: 'visitor-secret-2' },
    });
    expect(replaced.isProtected).toBe(true);

    const open = await $fetch<{ isProtected: boolean }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: null },
    });
    expect(open.isProtected).toBe(false);
  });

  it('redirects through the password page without leaking the destination', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/hidden-target', slug: 'pw-gate' },
      headers: { cookie },
    });
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: 'gate-pass' },
    });

    const before = await readTestLink(TEST_DB, link.id);
    const gate = await fetch(`/${link.slug}`, { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(gate.status).toBe(302);
    expect(gate.headers.get('location')).toContain(`/p/${link.slug}`);

    const page = await $fetch<string>(`/p/${link.slug}`, { responseType: 'text' });
    expect(page).not.toContain('hidden-target');

    const afterView = await readTestLink(TEST_DB, link.id);
    expect(afterView.clickCount).toBe(before.clickCount);

    const bad = await fetch('/api/links/verify-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': CHROME_UA },
      body: JSON.stringify({ slug: link.slug, password: 'wrong' }),
    });
    expect(bad.status).toBe(401);

    const verify = await fetch('/api/links/verify-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': CHROME_UA },
      body: JSON.stringify({ slug: link.slug, password: 'gate-pass' }),
    });
    expect(verify.status).toBe(200);
    const verifyCookie = verify.headers.get('set-cookie') ?? '';

    const ok = await fetch(`/${link.slug}`, {
      redirect: 'manual',
      headers: { cookie: verifyCookie.split(';')[0]!, 'user-agent': CHROME_UA },
    });
    expect(ok.status).toBe(302);
    expect(ok.headers.get('location')).toContain('hidden-target');
  });

  it('returns 429 after repeated wrong password attempts', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/rate', slug: 'pw-rate' },
      headers: { cookie },
    });
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: 'real-pass' },
    });

    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const res = await fetch('/api/links/verify-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': CHROME_UA },
        body: JSON.stringify({ slug: link.slug, password: 'wrong' }),
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('sets a password when the link is created', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string; isProtected: boolean }>('/api/links', {
      method: 'POST',
      headers: { cookie },
      body: { destinationUrl: 'https://example.com/new', slug: 'pwd-create', password: 'create-secret' },
    });
    expect(link.isProtected).toBe(true);
    expect(JSON.stringify(link)).not.toContain('passwordHash');

    const res = await fetch('/pwd-create', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    const location = new URL(res.headers.get('location') ?? '', 'http://localhost');
    expect(location.pathname).toBe('/p/pwd-create');
    expect(location.searchParams.get('path')).toBe('/pwd-create');
  });
});
