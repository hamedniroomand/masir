import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('shows only the sign-in providers the operator configured', async ({ page }) => {
  await page.goto('/login');
  const google = page.getByRole('link', { name: 'Continue with Google' });
  await expect(google).toBeVisible();
  // The callback needs a real provider, so only the button and its target are
  // checked here.
  await expect(google).toHaveAttribute('href', '/api/auth/google');
  await expect(page.getByRole('link', { name: 'Continue with Microsoft' })).toHaveCount(0);
});

// The account page lives in the shell, which needs a workspace host.
test('offers to connect only the configured provider on the account page', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/settings/account`);
  await expect(page.getByRole('link', { name: 'Connect Google' })).toHaveAttribute('href', '/api/auth/google');
  await expect(page.getByRole('link', { name: 'Connect Microsoft' })).toHaveCount(0);
});

test('hides the password form until the visitor asks for email sign-in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in with email instead' }).click();
  await expect(page.getByLabel('Password')).toBeVisible();

  await page.goto('/register');
  await expect(page.getByLabel(/^Password/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign up with email instead' }).click();
  await expect(page.getByLabel(/^Password/)).toBeVisible();
});
