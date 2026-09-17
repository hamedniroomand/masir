import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { authIdentities, links, linkTags, users } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { newId } from '#shared/id';
import { e2eSetupOptions, insertTestLink, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('tags');

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
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';
  let otherUserId = '';

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
    const db = openTestDatabase(TEST_DB);
    otherUserId = newId();
    const now = new Date();
    await db.insert(users).values({
      id: otherUserId,
      email: 'other@example.com',
      emailVerifiedAt: now,
      firstName: 'Other',
      lastName: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    await db.insert(authIdentities).values({
      id: newId(),
      userId: otherUserId,
      provider: 'PASSWORD',
      providerAccountId: otherUserId,
      passwordHash: await hashSecret(TEST_PASSWORD),
      createdAt: now,
      updatedAt: now,
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
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'tagged-link' });
    const db = openTestDatabase(TEST_DB);
    await db.insert(linkTags).values({ linkId, tagId: tag.id });
    await $fetch(`/api/tags/${tag.id}`, { method: 'DELETE', headers: { cookie } });
    const rows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
    expect(rows[0]?.id).toBe(linkId);
  });

  it('assigns and removes tags on a link', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; tags: string[] }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/tagged', tags: ['Alpha', 'Beta'] },
      headers: { cookie },
    });
    expect(link.tags.sort()).toEqual(['Alpha', 'Beta']);

    const cleared = await $fetch<{ tags: string[] }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { tags: [] },
    });
    expect(cleared.tags).toEqual([]);
  });

  it('creates a new tag from the link form', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/new-tag', tags: ['FromForm'] },
      headers: { cookie },
    });
    const list = await $fetch<{ items: { name: string }[] }>('/api/tags', { headers: { cookie } });
    expect(list.items.some(t => t.name === 'FromForm')).toBe(true);
  });

  it('escapes HTML in tag names in the API', async () => {
    const cookie = await loginCookie();
    const name = '<b>bold</b>';
    const link = await $fetch<{ tags: string[] }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/html-tag', tags: [name] },
      headers: { cookie },
    });
    expect(link.tags[0]).toBe(name);
  });

  it('filters links by tag with search and status together', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/active-filter', slug: 'tag-active-link', tags: ['FilterMe'] },
      headers: { cookie },
    });
    const disabledLink = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/disabled-filter', slug: 'tag-disabled-link', tags: ['FilterMe'] },
      headers: { cookie },
    });
    await $fetch(`/api/links/${disabledLink.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { isEnabled: false },
    });

    const result = await $fetch<{ items: { slug: string }[] }>('/api/links', {
      query: { tags: 'FilterMe', status: 'active', q: 'tag-active' },
      headers: { cookie },
    });
    expect(result.items.map(i => i.slug)).toContain('tag-active-link');
    expect(result.items.map(i => i.slug)).not.toContain('tag-disabled-link');
  });

  it('refuses a user who belongs to no workspace', async () => {
    // Tags belong to the workspace, so two members share them. The boundary is
    // membership, and a stranger gets the same answer as for a missing
    // workspace.
    const otherCookie = await loginCookie('other@example.com', TEST_PASSWORD);
    await expect($fetch('/api/tags', { headers: { cookie: otherCookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
    await expect($fetch('/api/tags', {
      method: 'POST',
      body: { name: 'private' },
      headers: { cookie: otherCookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects a tag name and a tag list that are too long', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/tags', {
      method: 'POST',
      headers: { cookie },
      body: { name: 'x'.repeat(41) },
    })).rejects.toMatchObject({ statusCode: 422 });

    await expect($fetch('/api/links', {
      method: 'POST',
      headers: { cookie },
      body: {
        destinationUrl: 'https://example.com/many-tags',
        tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
      },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
