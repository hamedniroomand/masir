import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('refuses registration when the operator turned it off', async ({ page }) => {
  const api = await page.request.post('/api/auth/register', {
    data: { email: 'stranger@example.com', password: 'a-long-enough-password' },
  });
  expect(api.status()).toBe(404);

  await page.goto('/register');
  await page.getByLabel('Email').fill('stranger@example.com');
  await page.getByLabel('Password').fill('a-long-enough-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
