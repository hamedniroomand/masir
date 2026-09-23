import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents } from '#server/database/schema';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl, waitFor } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('attribution_history');

type CampaignDto = {
  id: string;
  name: string;
  utmCampaign: string;
  utmMedium: string | null;
  linkCount: number;
  clickCount: number;
};

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

describe('attribution history [AN-02 / R1 exit]', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('keeps historical clicks under previous utmSource when edited', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Edit Campaign', utmCampaign: 'edit-camp' },
      headers: { cookie },
    });

    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/hist-edit', campaignId: campaign.id, utmSource: 'initial' },
      headers: { cookie },
    });

    // Generate two clicks with initial source
    await fetch(`/${link.slug}`, { redirect: 'manual' });
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Change utmSource
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { utmSource: 'updated' },
      headers: { cookie },
    });

    // Generate one click with updated source
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Verify recorded attribution: two clicks under 'initial', one click under 'updated'
    const recorded = await waitFor(
      () => $fetch<{
        bySource: { label: string; count: number }[];
        meta: { attribution: string; legacyCount: number };
      }>(`/api/campaigns/${campaign.id}/analytics?attribution=recorded`, { headers: { cookie } }),
      result => result.bySource.length >= 2,
    );

    expect(recorded.meta.attribution).toBe('recorded');
    const initialEntry = recorded.bySource.find(entry => entry.label === 'initial');
    const updatedEntry = recorded.bySource.find(entry => entry.label === 'updated');
    expect(initialEntry?.count).toBe(2);
    expect(updatedEntry?.count).toBe(1);

    // Verify current attribution: all three clicks appear under 'updated'
    const current = await $fetch<{
      bySource: { label: string; count: number }[];
      meta: { attribution: string; legacyCount: number };
    }>(`/api/campaigns/${campaign.id}/analytics?attribution=current`, { headers: { cookie } });
    expect(current.meta.attribution).toBe('current');
    expect(current.bySource).toEqual([{ label: 'updated', count: 3 }]);
  });

  it('preserves past clicks in recorded mode when link moves between campaigns', async () => {
    const cookie = await loginCookie();
    const campaignA = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Source Camp', utmCampaign: 'source-camp' },
      headers: { cookie },
    });
    const campaignB = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Target Camp', utmCampaign: 'target-camp' },
      headers: { cookie },
    });

    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/move', campaignId: campaignA.id, utmSource: 'social' },
      headers: { cookie },
    });

    // Click while linked to campaign A
    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Move link to campaign B
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { campaignId: campaignB.id },
      headers: { cookie },
    });

    // Recorded analytics for campaign A preserves the earlier click
    const recordedA = await waitFor(
      () => $fetch<{ periodClicks: number; meta: { attribution: string } }>(
        `/api/campaigns/${campaignA.id}/analytics?attribution=recorded`,
        { headers: { cookie } },
      ),
      result => result.periodClicks >= 1,
    );
    expect(recordedA.periodClicks).toBe(1);

    // Current analytics for campaign A reflects current links (none)
    const currentA = await $fetch<{ periodClicks: number; meta: { attribution: string } }>(
      `/api/campaigns/${campaignA.id}/analytics?attribution=current`,
      { headers: { cookie } },
    );
    expect(currentA.periodClicks).toBe(0);
  });

  it('leaves recorded events queryable by utm_campaign when campaign is deleted', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Purged Camp', utmCampaign: 'purged-camp' },
      headers: { cookie },
    });
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/purged', campaignId: campaign.id },
      headers: { cookie },
    });

    await fetch(`/${link.slug}`, { redirect: 'manual' });

    // Delete the campaign
    await $fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE', headers: { cookie } });

    // Ensure database rows remain with snapshotted utm_campaign
    const database = openTestDatabase(TEST_DB);
    const events = await waitFor(
      () => database.select().from(clickEvents).where(eq(clickEvents.utmCampaign, 'purged-camp')),
      rows => rows.length >= 1,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.utmCampaign).toBe('purged-camp');
    expect(events[0]?.campaignId).toBe(campaign.id);
  });
});
