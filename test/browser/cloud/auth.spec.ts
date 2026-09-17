import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('shows only the sign-in providers the operator configured', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with Microsoft' })).toHaveCount(0);
});

test('hides the password form until the visitor asks for email sign-in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in with email instead' }).click();
  await expect(page.getByLabel('Password')).toBeVisible();

  await page.goto('/register');
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign up with email instead' }).click();
  await expect(page.getByLabel('Password')).toBeVisible();
});
