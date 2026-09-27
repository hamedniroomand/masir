import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { and, count, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, links } from '#server/database/schema';
import { e2eSetupOptions, insertTestCampaign, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl, waitFor } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('links-batch');

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

async function campaignLinkCount(campaignId: string) {
  const db = openTestDatabase(TEST_DB);
  const [row] = await db.select({ n: count() }).from(links).where(and(eq(links.campaignId, campaignId)));
  return Number(row?.n ?? 0);
}

describe('links batch API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId: string;

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
  });

  it('creates three channel links in one request', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'batch-test', utmMedium: 'email' });
    const res = await $fetch<{ results: { clientKey: string; status: string; link?: { slug: string; utmSource: string | null } }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/page',
        title: 'Batch',
        items: [
          { clientKey: 'newsletter', utmSource: 'newsletter', utmMedium: 'email' },
          { clientKey: 'social', utmSource: 'twitter', utmMedium: 'social' },
          { clientKey: 'print', utmSource: 'print', utmMedium: 'print' },
        ],
      },
      headers: { cookie },
    });

    expect(res.results).toHaveLength(3);
    for (const r of res.results)
      expect(r.status).toBe('created');
    const sources = res.results.map(r => r.link?.utmSource);
    expect(sources).toEqual(['newsletter', 'twitter', 'print']);
    expect(await campaignLinkCount(campaignId)).toBe(3);

    const db = openTestDatabase(TEST_DB);
    const created = await db.select().from(auditEvents).where(eq(auditEvents.type, 'link_created'));
    expect(created.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses the whole batch when one slug is taken', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'dup-test' });
    await $fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/existing', slug: 'taken-slug' },
      headers: { cookie },
    });

    const res = await $fetch<{ rows?: { clientKey: string; error: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/dup',
        items: [
          { clientKey: 'ok', utmSource: 'a' },
          { clientKey: 'dup', utmSource: 'b', slug: 'taken-slug' },
        ],
      },
      headers: { cookie },
    }).catch((e: unknown) => e as { statusCode?: number; data?: { data?: { rows?: { clientKey: string; error: string }[] } } });

    expect((res as { data?: { statusCode?: number } }).data?.statusCode).toBe(422);
    const rows = (res as { data?: { data?: { rows?: { clientKey: string; error: string }[] } } }).data?.data?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientKey).toBe('dup');
    expect(await campaignLinkCount(campaignId)).toBe(0);
  });

  it('refuses intra-batch duplicate slugs and clientKeys before creating anything', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'intra-dup' });

    const slugDup = await $fetch('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/intra',
        items: [
          { clientKey: 'a', utmSource: 'a', slug: 'same-slug' },
          { clientKey: 'b', utmSource: 'b', slug: 'Same-Slug' },
        ],
      },
      headers: { cookie },
    }).catch((e: unknown) => e as { data?: { statusCode?: number; data?: { rows?: { clientKey: string; error: string }[] } } });

    expect(slugDup.data?.statusCode).toBe(422);
    expect(slugDup.data?.data?.rows?.some(r => r.clientKey === 'b')).toBe(true);
    expect(await campaignLinkCount(campaignId)).toBe(0);

    const keyDup = await $fetch('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/intra-key',
        items: [
          { clientKey: 'same', utmSource: 'a' },
          { clientKey: 'same', utmSource: 'b' },
        ],
      },
      headers: { cookie },
    }).catch((e: unknown) => e as { data?: { statusCode?: number; data?: { rows?: { clientKey: string }[] } } });

    expect(keyDup.data?.statusCode).toBe(422);
    expect(await campaignLinkCount(campaignId)).toBe(0);
  });

  it('retries only error clientKeys after a partial create failure', async () => {
    // createLink ignores clientKey (not an idempotency key). CampaignBatchForm
    // retries only status "error" rows. Force a real mixed result: hold an
    // uncommitted insert on the failing slug so validate-all-first passes, then
    // commit so create hits the unique index.
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'retry-partial' });
    const stamp = String(Date.now());
    const okKey = `ok-${stamp}`;
    const failKey = `fail-${stamp}`;
    const failSlug = `fail-${stamp}`;
    const okSlug = `ok-${stamp}`;

    const { SQL } = await import('bun');
    const blocker = new SQL({ url: TEST_DB, max: 1 });
    try {
      await blocker`begin`;
      await blocker`
        insert into links (workspace_id, slug, destination_url, destination_host)
        values (${workspaceId}::uuid, ${failSlug}, 'https://example.com/blocker', 'example.com')
      `;

      const batchPromise = $fetch<{ results: { clientKey: string; status: string; error?: string }[] }>('/api/links/batch', {
        method: 'POST',
        body: {
          campaignId,
          destinationUrl: 'https://example.com/retry-partial',
          items: [
            { clientKey: okKey, utmSource: 'ok', slug: okSlug },
            { clientKey: failKey, utmSource: 'fail', slug: failSlug },
          ],
        },
        headers: { cookie },
      });

      // First create is past validate-all-first; the second create waits on our row.
      await waitFor(() => campaignLinkCount(campaignId), n => n >= 1);
      await blocker`commit`;

      const partial = await batchPromise;
      expect(partial.results).toHaveLength(2);
      expect(partial.results.find(r => r.clientKey === okKey)?.status).toBe('created');
      expect(partial.results.find(r => r.clientKey === failKey)?.status).toBe('error');
    }
    finally {
      await blocker`rollback`.catch(() => null);
      await blocker.close();
    }

    const beforeRetry = await campaignLinkCount(campaignId);
    expect(beforeRetry).toBe(1);

    const retry = await $fetch<{ results: { clientKey: string; status: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/retry-partial',
        items: [{ clientKey: failKey, utmSource: 'fail', slug: `retry-${stamp}` }],
      },
      headers: { cookie },
    });
    expect(retry.results).toHaveLength(1);
    expect(retry.results[0]?.clientKey).toBe(failKey);
    expect(retry.results[0]?.status).toBe('created');
    expect(await campaignLinkCount(campaignId)).toBe(2);

    // Naive resend of a created clientKey creates another link.
    const naive = await $fetch<{ results: { clientKey: string; status: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: {
        campaignId,
        destinationUrl: 'https://example.com/retry-partial',
        items: [{ clientKey: okKey, utmSource: 'ok-again' }],
      },
      headers: { cookie },
    });
    expect(naive.results[0]?.status).toBe('created');
    expect(await campaignLinkCount(campaignId)).toBe(3);
  });

  it('refuses an empty items list', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links/batch', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/empty', items: [] },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('refuses more than 20 items', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links/batch', {
      method: 'POST',
      body: {
        destinationUrl: 'https://example.com/big',
        items: Array.from({ length: 21 }, (_, i) => ({ clientKey: `k${i}`, utmSource: 'x' })),
      },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
