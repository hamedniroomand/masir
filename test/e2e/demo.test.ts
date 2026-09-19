import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { count, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { authIdentities, clickEvents, links, users, workspaces } from '#server/database/schema';
import { DEMO_LINK_CAP, SEED_LINKS } from '#server/utils/demo';
import { e2eSetupOptions, testDatabaseUrl } from './helpers';
import { openTestDatabase, truncateTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('demo');
const JOBS_SECRET = 'test-jobs-secret';

// Requests reach this server on 127.0.0.1, so no request carries a workspace
// host. The demo route and the sweep need none.
const MULTI_ENV = {
  NUXT_MULTI_WORKSPACE: 'true',
  NUXT_ROOT_DOMAIN: 'http://masir.test:3000',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://masir.test:3000',
  NUXT_SESSION_COOKIE_DOMAIN: '.masir.test',
  NUXT_DEMO_ENABLED: 'true',
  NUXT_JOBS_SECRET: JOBS_SECRET,
  NUXT_ALERTS_INTERVAL_MINUTES: '0',
};

let cookie = '';
let slug = '';
let workspaceId = '';
let userId = '';

describe('demo access', async () => {
  await setup(await e2eSetupOptions(TEST_DB, MULTI_ENV));

  beforeAll(async () => {
    await truncateTestDatabase(TEST_DB);
  });

  // The landing button reads this field. One gate drives both, so an operator
  // who sets NUXT_DEMO_ENABLED gets the route and the button together.
  it('reports the demo on the host info', async () => {
    expect(await $fetch('/api/host')).toMatchObject({ demo: true });
  });

  // The route is limited to 3 calls an hour for each client. Every test below
  // reuses this one demo.
  it('creates a seeded demo workspace and signs the visitor in', async () => {
    const res = await fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(201);
    const body = await res.json() as { url: string };
    expect(body.url).toMatch(/^http:\/\/demo-[a-z0-9]{8}\.masir\.test:3000$/);
    slug = new URL(body.url).hostname.split('.')[0]!;
    cookie = res.headers.get('set-cookie')!.split(';')[0]!;

    const db = openTestDatabase(TEST_DB);
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
    expect(workspace).toBeDefined();
    workspaceId = workspace!.id;
    expect(workspace!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(workspace!.expiresAt!.getTime()).toBeLessThan(Date.now() + 25 * 3_600_000);

    const [user] = await db.select().from(users).where(eq(users.email, `${slug}@demo.invalid`));
    expect(user).toBeDefined();
    userId = user!.id;
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(await db.select().from(authIdentities).where(eq(authIdentities.userId, userId))).toHaveLength(0);

    const seeded = await db.select().from(links).where(eq(links.workspaceId, workspaceId));
    expect(seeded.map(link => link.slug).sort()).toEqual(SEED_LINKS.map(link => link.slug).sort());
    for (const link of seeded) {
      const [human] = await db.select({ n: count() }).from(clickEvents).where(eq(clickEvents.linkId, link.id));
      expect(human!.n).toBeGreaterThan(link.clickCount);
    }
    expect(DEMO_LINK_CAP).toBe(9);
  });

  it('lists the demo workspace with its expiry for the signed-in visitor', async () => {
    const list = await $fetch<{ items: { slug: string; expiresAt: string | null }[] }>('/api/workspaces', { headers: { cookie } });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.slug).toBe(slug);
    expect(list.items[0]!.expiresAt).toBeTruthy();
  });

  it('refuses a new workspace from a demo session', async () => {
    await expect($fetch('/api/workspaces', {
      method: 'POST',
      body: { name: 'Second' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('sweeps an expired demo, leaves a live one, and keeps its click events', async () => {
    const db = openTestDatabase(TEST_DB);
    const before = await $fetch<{ demosDeleted: number }>('/api/jobs/alerts', {
      method: 'POST',
      headers: { authorization: `Bearer ${JOBS_SECRET}` },
    });
    expect(before.demosDeleted).toBe(0);

    await db.update(workspaces).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(workspaces.id, workspaceId));
    const after = await $fetch<{ demosDeleted: number }>('/api/jobs/alerts', {
      method: 'POST',
      headers: { authorization: `Bearer ${JOBS_SECRET}` },
    });
    expect(after.demosDeleted).toBe(1);

    expect(await db.select().from(workspaces).where(eq(workspaces.id, workspaceId))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, userId))).toHaveLength(0);
    const [events] = await db.select({ n: count() }).from(clickEvents).where(eq(clickEvents.workspaceId, workspaceId));
    expect(events!.n).toBeGreaterThan(0);

    // The old cookie now names a user that is gone.
    await expect($fetch('/api/workspaces', { headers: { cookie } })).rejects.toMatchObject({ statusCode: 401 });
  });
});
