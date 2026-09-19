import { expect, test } from '../fixtures';

// Normal work writes the rows. Creating a link and changing it gives the page
// two event types to tell apart.
test.beforeAll(({ db }) => {
  db.reset();
});

test('lists what happened in the workspace with the actor and a link chip', async ({ page, login }) => {
  await login();
  const created = await page.request.post('/api/links', { data: { destinationUrl: 'https://example.com/audit', slug: 'audit' } });
  const link = await created.json() as { id: string };
  await page.request.patch(`/api/links/${link.id}`, { data: { isEnabled: false } });

  await page.goto('/settings/security');
  await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible();

  const row = page.getByRole('list', { name: 'Activity' }).getByRole('listitem').filter({ hasText: 'created link' });
  await expect(row).toContainText('test@example.com');
  await expect(row.getByRole('link', { name: '/audit' })).toBeVisible();
  await expect(page.getByText('changed link')).toBeVisible();
});

test('narrows the list to one group', async ({ page, login }) => {
  await login();
  await page.request.post('/api/campaigns', { data: { name: 'Spring', utmCampaign: 'spring' } });

  await page.goto('/settings/security');
  await expect(page.getByText('created link')).toBeVisible();

  await page.getByRole('tab', { name: 'Campaigns' }).click();
  await expect(page.getByText('created a campaign')).toBeVisible();
  await expect(page.getByText('created link')).toHaveCount(0);
});

test('appends the next page with Load more', async ({ page, login }) => {
  await login();
  for (let i = 0; i < 4; i++)
    await page.request.post('/api/links', { data: { destinationUrl: `https://example.com/more-${i}` } });

  await page.route('**/api/admin/audit-events**', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('limit', '2');
    await route.continue({ url: url.toString() });
  });

  await page.goto('/settings/security');
  const rows = page.getByRole('list', { name: 'Activity' }).getByRole('listitem');
  await expect(rows).toHaveCount(2);

  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(rows).toHaveCount(4);
});

test('offers a retry when the read fails', async ({ page, login }) => {
  await login();
  await page.route('**/api/admin/audit-events**', route => route.abort());
  await page.goto('/settings/security');
  await expect(page.getByText('Could not load the activity log')).toBeVisible();

  await page.unroute('**/api/admin/audit-events**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('created link').first()).toBeVisible();
});
