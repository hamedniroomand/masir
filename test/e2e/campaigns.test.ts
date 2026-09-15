import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabasePath } from './helpers';

const TEST_DB = testDatabasePath('campaigns');

interface CampaignDto { id: string; name: string; utmCampaign: string; utmMedium: string | null; linkCount: number; clickCount: number }

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
  await setup(e2eSetupOptions(TEST_DB));

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

  it('renders the campaigns pages', async () => {
    const cookie = await loginCookie();
    const campaign = await $fetch<CampaignDto>('/api/campaigns', {
      method: 'POST',
      body: { name: 'Rendered', utmCampaign: 'rendered' },
      headers: { cookie },
    });

    const list = await $fetch<string>('/campaigns', { responseType: 'text', headers: { cookie } });
    expect(list).toContain('Rendered');

    const detail = await $fetch<string>(`/campaigns/${campaign.id}`, { responseType: 'text', headers: { cookie } });
    expect(detail).toContain('utm_campaign=rendered');
    expect(detail).toContain('Link performance');
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
});
