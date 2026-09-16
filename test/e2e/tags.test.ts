import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '#scripts/hash-password';
import { links, linkTags, users } from '#server/database/schema';
import { newId } from '#shared/id';
import { e2eSetupOptions, insertTestLink, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabasePath } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabasePath('tags');

async function loginCookie(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

describe('tags API', async () => {
  await setup(e2eSetupOptions(TEST_DB));

  let userId = '';
  let otherUserId = '';

  beforeAll(async () => {
    ({ userId } = await resetTestDb(TEST_DB));
    const db = openTestDatabase(TEST_DB);
    otherUserId = newId();
    await db.insert(users).values({
      id: otherUserId,
      email: 'other@example.com',
      passwordHash: await hashPassword(TEST_PASSWORD),
      name: 'Other',
      role: 'member',
      isActive: true,
      createdAt: new Date(),
    });
  });

  it('creates, renames, and deletes tags', async () => {
    const cookie = await loginCookie();
    const created = await $fetch<{ id: string; name: string }>('/api/tags', {
      method: 'POST',
      body: { name: 'Launch' },
      headers: { cookie },
    });
    expect(created.name).toBe('Launch');

    const renamed = await $fetch<{ name: string }>(`/api/tags/${created.id}`, {
      method: 'PATCH',
      body: { name: 'Spring Launch' },
      headers: { cookie },
    });
    expect(renamed.name).toBe('Spring Launch');

    await $fetch(`/api/tags/${created.id}`, { method: 'DELETE', headers: { cookie } });
    const list = await $fetch<{ items: { id: string }[] }>('/api/tags', { headers: { cookie } });
    expect(list.items.some(t => t.id === created.id)).toBe(false);
  });

  it('normalizes duplicate names to one row', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/tags', { method: 'POST', body: { name: '  Email  ' }, headers: { cookie } });
    await $fetch('/api/tags', { method: 'POST', body: { name: 'email' }, headers: { cookie } });
    const list = await $fetch<{ items: { name: string }[] }>('/api/tags', { headers: { cookie } });
    const emailTags = list.items.filter(t => t.name.toLowerCase() === 'email' || t.name === 'Email');
    expect(emailTags.length).toBeLessThanOrEqual(1);
  });

  it('keeps links when a tag is deleted', async () => {
    const cookie = await loginCookie();
    const tag = await $fetch<{ id: string }>('/api/tags', {
      method: 'POST',
      body: { name: 'temp-tag' },
      headers: { cookie },
    });
    const linkId = await insertTestLink(TEST_DB, { userId, slug: 'tagged-link' });
    const db = openTestDatabase(TEST_DB);
    await db.insert(linkTags).values({ linkId, tagId: tag.id });
    await $fetch(`/api/tags/${tag.id}`, { method: 'DELETE', headers: { cookie } });
    const rows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
    expect(rows[0]?.id).toBe(linkId);
  });

  it('blocks access to another user tag', async () => {
    const otherCookie = await loginCookie('other@example.com', TEST_PASSWORD);
    const otherTag = await $fetch<{ id: string }>('/api/tags', {
      method: 'POST',
      body: { name: 'private' },
      headers: { cookie: otherCookie },
    });

    const cookie = await loginCookie();
    await expect($fetch(`/api/tags/${otherTag.id}`, { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
    await expect($fetch(`/api/tags/${otherTag.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { name: 'stolen' },
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
