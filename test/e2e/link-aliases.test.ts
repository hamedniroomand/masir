import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  e2eSetupOptions,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';

const TEST_DB = testDatabaseUrl('link-aliases');

let cookie = '';

type LinkDto = { id: string; slug: string; aliases: string[] };

async function login() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

function createLink(body: Record<string, unknown>) {
  return $fetch<LinkDto>('/api/links', { method: 'POST', body, headers: { cookie } });
}

function addAlias(id: string, slug: string) {
  return $fetch(`/api/links/${id}/aliases`, { method: 'POST', body: { slug }, headers: { cookie } });
}

function readLink(id: string) {
  return $fetch<LinkDto>(`/api/links/${id}`, { headers: { cookie } });
}

describe('link aliases and slug rename', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
    cookie = await login();
  });

  it('resolves an alias, counts the click on the link, and lists it in the dto', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/aliased', slug: 'primary' });
    await addAlias(link.id, 'second-name');

    const read = await readLink(link.id);
    expect(read.aliases).toEqual(['second-name']);

    const res = await fetch('/second-name', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/aliased');

    // A second request answers from the cache and must give the same result.
    const again = await fetch('/second-name', { redirect: 'manual' });
    expect(again.headers.get('location')).toBe('https://example.com/aliased');

    const row = await readTestLink(TEST_DB, link.id);
    expect(row.clickCount).toBe(2);
  });

  it('refuses a slug that a link, a deleted link, an alias, or a reserved name holds', async () => {
    const deleted = await createLink({ destinationUrl: 'https://example.com/gone', slug: 'was-here' });
    await $fetch(`/api/links/${deleted.id}`, { method: 'DELETE', headers: { cookie } });

    for (const slug of ['was-here', 'second-name', 'primary', 'login']) {
      await expect(createLink({ destinationUrl: 'https://example.com/x', slug }))
        .rejects
        .toMatchObject({ statusCode: slug === 'login' ? 422 : 409 });
    }

    const free = await createLink({ destinationUrl: 'https://example.com/free', slug: 'never-used' });
    expect(free.slug).toBe('never-used');
  });

  it('answers 404 for an alias of a deleted link', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/doomed', slug: 'doomed' });
    await addAlias(link.id, 'doomed-alias');
    expect((await fetch('/doomed-alias', { redirect: 'manual' })).status).toBe(302);

    await $fetch(`/api/links/${link.id}`, { method: 'DELETE', headers: { cookie } });
    expect((await fetch('/doomed-alias', { redirect: 'manual' })).status).toBe(404);
  });

  it('stops a removed alias but keeps its slug taken', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/temp', slug: 'temp' });
    await addAlias(link.id, 'temp-alias');
    await $fetch(`/api/links/${link.id}/aliases/temp-alias`, { method: 'DELETE', headers: { cookie } });

    expect((await fetch('/temp-alias', { redirect: 'manual' })).status).toBe(404);
    expect((await readLink(link.id)).aliases).toEqual([]);
    await expect(createLink({ destinationUrl: 'https://example.com/y', slug: 'temp-alias' }))
      .rejects
      .toMatchObject({ statusCode: 409 });
  });

  it('refuses the eleventh alias', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/many', slug: 'many' });
    for (let i = 0; i < 10; i++)
      await addAlias(link.id, `many-${i}`);
    await expect(addAlias(link.id, 'many-eleven')).rejects.toMatchObject({ statusCode: 422 });
    expect((await readLink(link.id)).aliases).toHaveLength(10);
  });

  it('renames a slug and keeps the old address as an alias', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/renamed', slug: 'old-name' });
    const patched = await $fetch<LinkDto>(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { slug: 'new-name' },
      headers: { cookie },
    });
    expect(patched.slug).toBe('new-name');
    expect(patched.aliases).toEqual(['old-name']);

    expect((await fetch('/new-name', { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/renamed');
    expect((await fetch('/old-name', { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/renamed');
  });

  it('drops the old address when keepOldSlug is false and still refuses to reuse it', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/moved', slug: 'drop-me' });
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { slug: 'kept-name', keepOldSlug: false },
      headers: { cookie },
    });

    expect((await fetch('/drop-me', { redirect: 'manual' })).status).toBe(404);
    await expect(createLink({ destinationUrl: 'https://example.com/z', slug: 'drop-me' }))
      .rejects
      .toMatchObject({ statusCode: 409 });
  });

  it('refuses a rename to a slug somebody else holds', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/a', slug: 'rename-source' });
    await createLink({ destinationUrl: 'https://example.com/b', slug: 'rename-target' });
    await expect($fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { slug: 'rename-target' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('promotes one of the link own aliases to the primary slug', async () => {
    const link = await createLink({ destinationUrl: 'https://example.com/promote', slug: 'promote-me' });
    await addAlias(link.id, 'promoted');
    const patched = await $fetch<LinkDto>(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { slug: 'promoted' },
      headers: { cookie },
    });
    expect(patched.slug).toBe('promoted');
    expect(patched.aliases).toEqual(['promote-me']);
    expect((await fetch('/promoted', { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/promote');
  });
});
