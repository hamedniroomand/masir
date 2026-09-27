import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents } from '#server/database/schema';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl, waitFor } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('campaigns');

type CampaignDto = { id: string; name: string; utmCampaign: string; utmMedium: string | null; linkCount: number; clickCount: number };

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

describe('campaigns API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('creates a campaign and attaches a link to it', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Spring launch', utmCampaign: 'spring-launch', utmMedium: 'email' },
      headers: { cookie },
    });
    expect(campaign.utmCampaign).toBe('spring-launch');

    const link = await $fetch<{ id: string; campaignId: string | null; utmSource: string | null }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/page', campaignId: campaign.id, utmSource: 'newsletter' },
      headers: { cookie },
    });
    expect(link.campaignId).toBe(campaign.id);
    expect(link.utmSource).toBe('newsletter');

    const list = await $fetch<{ items: CampaignDto[] }>('/api/campaigns', { headers: { cookie } });
    expect(list.items[0]!.linkCount).toBe(1);
  });

  it('rejects a campaign id that does not exist', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/page', campaignId: 'missing' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a second campaign with the same utm_campaign', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/campaigns', {
      method: 'POST',
      body: { name: 'First', utmCampaign: 'shared-value' },
      headers: { cookie },
    });
    await expect($fetch('/api/campaigns', {
      method: 'POST',
      body: { name: 'Second', utmCampaign: 'shared-value' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('returns campaign analytics with a source breakdown', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Metrics', utmCampaign: 'metrics' },
      headers: { cookie },
    });
    const link = await $fetch<{ slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/m', campaignId: campaign.id, utmSource: 'twitter' },
      headers: { cookie },
    });
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    const analytics = await $fetch<{ totalClicks: number; linkCount: number; bySource: { label: string; count: number }[]; topLinks: { slug: string }[] }>(
      `/api/campaigns/${campaign.id}/analytics`,
      { headers: { cookie } },
    );
    expect(analytics.linkCount).toBe(1);
    expect(analytics.topLinks[0]!.slug).toBe(link.slug);
    expect(analytics.bySource[0]!.label).toBe('twitter');
  });

  it('clears the campaign from links when the campaign is deleted', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Temp', utmCampaign: 'temp' },
      headers: { cookie },
    });
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/t', campaignId: campaign.id },
      headers: { cookie },
    });
    await $fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE', headers: { cookie } });

    const after = await $fetch<{ campaignId: string | null }>(`/api/links/${link.id}`, { headers: { cookie } });
    expect(after.campaignId).toBe(null);
  });

  it('returns recorded attribution reflecting source at click time', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Source Test', utmCampaign: 'source-test', utmMedium: 'cpc' },
      headers: { cookie },
    });
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/st', campaignId: campaign.id, utmSource: 'old' },
      headers: { cookie },
    });

    // Two clicks with old source
    await fetch(`/${link.slug}`, { redirect: 'manual' });
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Change utmSource to new
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { utmSource: 'new' },
      headers: { cookie },
    });

    // One click with new source
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Wait for event writes and query recorded analytics
    const recorded = await waitFor(
      () => $fetch<{
        bySource: { label: string; count: number }[];
        byMedium: { label: string; count: number }[];
        meta: { attribution: string; legacyCount: number };
      }>(`/api/campaigns/${campaign.id}/analytics?attribution=recorded`, { headers: { cookie } }),
      res => res.bySource.length >= 2,
    );

    expect(recorded.meta.attribution).toBe('recorded');
    const oldEntry = recorded.bySource.find(s => s.label === 'old');
    const newEntry = recorded.bySource.find(s => s.label === 'new');
    expect(oldEntry?.count).toBe(2);
    expect(newEntry?.count).toBe(1);

    // In current mode, all 3 clicks appear under the link's current source ('new')
    const current = await $fetch<{
      bySource: { label: string; count: number }[];
      meta: { attribution: string; legacyCount: number };
    }>(`/api/campaigns/${campaign.id}/analytics?attribution=current`, { headers: { cookie } });
    expect(current.meta.attribution).toBe('current');
    expect(current.bySource).toEqual([{ label: 'new', count: 3 }]);
  });

  it('preserves past clicks in recorded mode when a link moves to another campaign', async () => {
    const cookie = await loginCookie();
    const campaignA = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Campaign A', utmCampaign: 'camp-a' },
      headers: { cookie },
    });
    const campaignB = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Campaign B', utmCampaign: 'camp-b' },
      headers: { cookie },
    });

    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/ab', campaignId: campaignA.id, utmSource: 'social' },
      headers: { cookie },
    });

    // Click on link while attached to campaign A
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Move link to campaign B
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { campaignId: campaignB.id },
      headers: { cookie },
    });

    // Verify recorded for campaign A keeps the earlier click
    const recordedA = await waitFor(
      () => $fetch<{ periodClicks: number; meta: { attribution: string } }>(
        `/api/campaigns/${campaignA.id}/analytics?attribution=recorded`,
        { headers: { cookie } },
      ),
      res => res.periodClicks >= 1,
    );
    expect(recordedA.periodClicks).toBe(1);

    // Verify current for campaign A loses it
    const currentA = await $fetch<{ periodClicks: number; meta: { attribution: string } }>(
      `/api/campaigns/${campaignA.id}/analytics?attribution=current`,
      { headers: { cookie } },
    );
    expect(currentA.periodClicks).toBe(0);
  });

  it('leaves events readable through utm_campaign after campaign is deleted', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Deletable', utmCampaign: 'to-be-deleted' },
      headers: { cookie },
    });
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/del', campaignId: campaign.id },
      headers: { cookie },
    });

    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Delete campaign
    await $fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE', headers: { cookie } });

    // Verify event in DB is still readable through utm_campaign
    const db = openTestDatabase(TEST_DB);
    const events = await waitFor(
      () => db.select().from(clickEvents).where(eq(clickEvents.utmCampaign, 'to-be-deleted')),
      rows => rows.length >= 1,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.utmCampaign).toBe('to-be-deleted');
    expect(events[0]?.campaignId).toBe(campaign.id);
  });

  it('returns unchanged response fields to an existing client without query', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Compat', utmCampaign: 'compat' },
      headers: { cookie },
    });

    const analytics = await $fetch<{
      totalClicks: number;
      linkCount: number;
      bySource: unknown[];
      topLinks: unknown[];
      periodClicks: number;
      series: unknown[];
      meta: { attribution: string; legacyCount: number };
    }>(`/api/campaigns/${campaign.id}/analytics`, { headers: { cookie } });

    expect(analytics).toHaveProperty('totalClicks');
    expect(analytics).toHaveProperty('linkCount');
    expect(analytics).toHaveProperty('bySource');
    expect(analytics).toHaveProperty('topLinks');
    expect(analytics).toHaveProperty('periodClicks');
    expect(analytics).toHaveProperty('series');
    expect(analytics.meta.attribution).toBe('current');
    expect(analytics.meta.legacyCount).toBe(0);
  });
});
