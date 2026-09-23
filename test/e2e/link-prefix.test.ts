import { fetch, setup } from '@nuxt/test-utils';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { links, workspaceLinkPrefixes } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
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
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('link_prefix');

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

describe('retained link prefixes', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
  });

  it('refuses a prefix equal to an existing slug with 409', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'taken-slug' });
    const cookie = await loginCookie();

    const res = await fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ linkPrefix: 'taken-slug', pathMode: 'preserve' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { data?: { reason?: string } };
    expect(body.data?.reason).toBe('prefix_conflict');
  });

  it('preserves the old address when changing the prefix and resolves both to the same destination', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'my-link',
      destinationUrl: 'https://example.com/dest-1',
    });
    const cookie = await loginCookie();

    // Link currently resolves at /my-link (root)
    const initialRes = await fetch('/my-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(initialRes.status).toBe(302);
    expect(initialRes.headers.get('location')).toBe('https://example.com/dest-1');

    // Change prefix to 'go' with preserve mode
    const patchRes = await fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ linkPrefix: 'go', pathMode: 'preserve' }),
    });
    expect(patchRes.status).toBe(200);

    // Old address (/my-link) still works
    const oldRes = await fetch('/my-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(oldRes.status).toBe(302);
    expect(oldRes.headers.get('location')).toBe('https://example.com/dest-1');

    // New address (/go/my-link) also works
    const newRes = await fetch('/go/my-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(newRes.status).toBe(302);
    expect(newRes.headers.get('location')).toBe('https://example.com/dest-1');

    // Check database has retained prefix ''
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceLinkPrefixes).where(and(
      eq(workspaceLinkPrefixes.workspaceId, workspaceId),
      eq(workspaceLinkPrefixes.prefix, ''),
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('retained');

    // Clean up link
    await db.delete(links).where(eq(links.id, linkId));
  });

  it('one-time link visited through the old path and then the new path consumes one visit only', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'one-time',
      maximumVisits: 1,
      destinationUrl: 'https://example.com/secret',
      limitDestination: 'https://example.com/limit-reached',
    });

    // First visit through old path /one-time succeeds
    const firstRes = await fetch('/one-time', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(firstRes.status).toBe(302);
    expect(firstRes.headers.get('location')).toBe('https://example.com/secret');

    // Second visit through new path /go/one-time hits visit limit
    const secondRes = await fetch('/go/one-time', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(secondRes.status).toBe(302);
    expect(secondRes.headers.get('location')).toBe('https://example.com/limit-reached');

    const updated = await readTestLink(TEST_DB, linkId);
    expect(updated.clickCount).toBe(1);

    const db = openTestDatabase(TEST_DB);
    await db.delete(links).where(eq(links.id, linkId));
  });

  it('password-protected link asked through old path redirects to password page and unlocks via requested path', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'pwd-link',
      destinationUrl: 'https://example.com/private',
      passwordHash: await hashSecret('secret123'),
    });

    // Asking through old path /pwd-link answers 302 to password page with requested path
    const unauthedOld = await fetch('/pwd-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(unauthedOld.status).toBe(302);
    expect(unauthedOld.headers.get('location')).toBe('/p/pwd-link?path=%2Fpwd-link');

    // Asking through new path /go/pwd-link answers 302 to password page with requested path
    const unauthedNew = await fetch('/go/pwd-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(unauthedNew.status).toBe(302);
    expect(unauthedNew.headers.get('location')).toBe('/p/pwd-link?path=%2Fgo%2Fpwd-link');

    // Submit password verification with requestedPath
    const verifyRes = await fetch('/api/links/verify-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'pwd-link', password: 'secret123', requestedPath: '/pwd-link' }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json() as { ok: boolean; redirectTo: string };
    expect(verifyBody.redirectTo).toBe('/pwd-link');

    // Extract grant cookie
    const grantCookie = verifyRes.headers.get('set-cookie')?.split(';')[0];
    expect(grantCookie).toBeDefined();

    // Now visiting /pwd-link with grant redirects to destination
    const authedOld = await fetch('/pwd-link', {
      redirect: 'manual',
      headers: { cookie: grantCookie!, 'user-agent': CHROME_UA },
    });
    expect(authedOld.status).toBe(302);
    expect(authedOld.headers.get('location')).toBe('https://example.com/private');

    const db = openTestDatabase(TEST_DB);
    await db.delete(links).where(eq(links.id, linkId));
  });

  it('revoking a retained prefix marks it revoked and stops old path resolving', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'revoke-test',
      destinationUrl: 'https://example.com/target',
    });
    const cookie = await loginCookie();

    // Old path /revoke-test works before revoke
    const beforeRes = await fetch('/revoke-test', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(beforeRes.status).toBe(302);

    // Revoke retained prefix '' using _root_ alias
    const revokeRes = await fetch('/api/workspaces/link-prefixes/_root_', {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(revokeRes.status).toBe(200);

    // After revoke, old path /revoke-test no longer resolves
    const afterRes = await fetch('/revoke-test', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(afterRes.status).toBe(404);

    // New path /go/revoke-test still resolves
    const newRes = await fetch('/go/revoke-test', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(newRes.status).toBe(302);

    // Database still contains the revoked row
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceLinkPrefixes).where(and(
      eq(workspaceLinkPrefixes.workspaceId, workspaceId),
      eq(workspaceLinkPrefixes.prefix, ''),
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('revoked');
    expect(rows[0]?.revokedAt).toBeInstanceOf(Date);

    await db.delete(links).where(eq(links.id, linkId));
  });

  it('a client that sends no pathMode gets the replace behavior', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'no-mode',
      destinationUrl: 'https://example.com/target',
    });
    const cookie = await loginCookie();

    // Change prefix from 'go' to 'track' with no pathMode specified
    const patchRes = await fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ linkPrefix: 'track' }),
    });
    expect(patchRes.status).toBe(200);

    // Old prefix /go/no-mode does not resolve (not retained)
    const oldRes = await fetch('/go/no-mode', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(oldRes.status).toBe(404);

    // New prefix /track/no-mode resolves
    const newRes = await fetch('/track/no-mode', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(newRes.status).toBe(302);

    const db = openTestDatabase(TEST_DB);
    await db.delete(links).where(eq(links.id, linkId));
  });
});
