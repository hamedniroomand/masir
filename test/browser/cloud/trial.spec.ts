import { expect, test } from '../fixtures';

const DAY_MS = 86_400_000;

test.beforeAll(({ db }) => {
  db.reset();
});

test('starts the configured trial when a workspace is created in cloud mode', async ({ page, login }) => {
  await login();
  await page.goto('/workspaces/new');
  await page.getByLabel('Company or workspace name').fill('Trial Co');
  const created = page.waitForResponse(response => response.url().endsWith('/api/workspaces') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const body = await (await created).json() as { plan: string; trialEndsAt: string | null };

  expect(body.plan).toBe('TRIAL');
  const daysLeft = (new Date(body.trialEndsAt!).getTime() - Date.now()) / DAY_MS;
  expect(daysLeft).toBeGreaterThan(13.9);
  expect(daysLeft).toBeLessThanOrEqual(14);
  await expect(page).toHaveURL(/\/workspaces\/invite\?slug=trial-co$/);
});

test('shows only the sign-in providers the operator configured', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with Microsoft' })).toHaveCount(0);
});
