import { expect, test } from '../fixtures';

// Normal work writes the rows. Creating a link and disabling it gives the page
// two event types to tell apart.
test.beforeAll(({ db }) => {
  db.reset();
});

test('lists what happened in the workspace', async ({ page, login }) => {
  await login();
  const created = await page.request.post('/api/links', { data: { destinationUrl: 'https://example.com/audit', slug: 'audit' } });
  const link = await created.json() as { id: string };
  await page.request.patch(`/api/links/${link.id}`, { data: { isEnabled: false } });

  await page.goto('/settings/security');
  await expect(page.getByRole('heading', { name: 'Security log' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'link created' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'link updated' })).toBeVisible();
});

test('narrows the list to one event type', async ({ page, login }) => {
  await login();
  await page.goto('/settings/security');
  await page.getByLabel('Filter security events by type').fill('link_created');
  await expect(page.getByRole('cell', { name: 'link created' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'link updated' })).toHaveCount(0);

  await page.getByLabel('Filter security events by type').fill('nothing_happened');
  await expect(page.getByText('No events match this type.')).toBeVisible();
});

test('shows the loading state and offers a retry when the read fails', async ({ page, login }) => {
  await login();
  await page.route('**/api/admin/audit-events**', route => route.abort());
  await page.goto('/settings/security');
  await expect(page.getByText('Could not load security events')).toBeVisible();

  // The retry reads again, and this time the route answers.
  await page.unroute('**/api/admin/audit-events**');
  await page.route('**/api/admin/audit-events**', async (route) => {
    await new Promise(done => setTimeout(done, 1000));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status', { name: 'Loading security events' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'link created' })).toBeVisible();
});
