import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('refuses registration when the operator turned it off', async ({ page }) => {
  const api = await page.request.post('/api/auth/register', {
    data: { email: 'stranger@example.com', password: 'a-long-enough-pass1!' },
  });
  expect(api.status()).toBe(404);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0);

  await page.goto('/register');
  await expect(page).toHaveURL(/\/login$/);
});
