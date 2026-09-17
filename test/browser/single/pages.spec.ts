import { expect, test } from '../fixtures';

// The dashboard renders on the client only, so what a page shows is a browser
// concern. These are the pages the HTTP suite used to read as HTML.
let workspaceId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
});

test('renders the campaign list and the campaign detail', async ({ page, login }) => {
  await login();
  const created = await page.request.post('/api/campaigns', { data: { name: 'Rendered', utmCampaign: 'rendered' } });
  const campaign = await created.json() as { id: string };

  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: /Campaigns/ })).toBeVisible();
  await expect(page.getByText('Rendered').first()).toBeVisible();

  await page.goto(`/campaigns/${campaign.id}`);
  await expect(page.getByRole('heading', { name: 'Rendered' })).toBeVisible();
  await expect(page.getByText('utm_campaign=rendered')).toBeVisible();
  await expect(page.getByText('Link performance')).toBeVisible();
});

test('renders the link detail with the tracking card', async ({ page, login }) => {
  await login();
  const created = await page.request.post('/api/links', { data: { destinationUrl: 'https://example.com/detail', utmSource: 'newsletter' } });
  const link = await created.json() as { id: string };

  await page.goto(`/links/${link.id}`);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Campaign and tracking')).toBeVisible();
  await expect(page.getByText('utm_source=newsletter')).toBeVisible();
});

// Without SSR the error page renders on the client, and the state the server
// attaches to the 404 (linkState, startsAt) does not reach it. Every visitor
// error reads "Link not found." until the server renders that page itself.
test.fixme('tells a visitor when a scheduled link opens', async ({ page, db }) => {
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  db.insertLink({ workspaceId, slug: 'schedule-page', startsAt });

  const response = await page.goto('/schedule-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This link is not available yet.' })).toBeVisible();
  await expect(page.getByText(/^Opens /)).toBeVisible();
});
