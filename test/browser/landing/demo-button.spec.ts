import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('walks the visitor through setup and lands them in the dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).first().click();

  // The steps pace the wait. The first is up before the request can finish.
  await expect(page.getByText('Creating your workspace')).toBeVisible();
  await expect(page.getByText('Adding sample links')).toBeVisible();
  await expect(page.getByText('Opening your dashboard')).toBeVisible();

  await page.waitForURL(/^http:\/\/demo-[a-z0-9]{8}\.masir\.test:\d+\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByText(/deleted in 2[34] hours/)).toBeVisible();
});

test('offers the demo only while the gate is on', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try the demo' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});
