import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('sends a signed-out visitor to the login page with the return path', async ({ page }) => {
  await page.goto('/settings/account');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/settings/account');
});

test('shows no provider buttons when no OAuth client is configured', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Continue with/ })).toHaveCount(0);
});

test('shows field errors on an empty submit and clears them as the user types', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your email.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();

  await page.getByLabel('Email').fill('someone@example.com');
  await expect(page.getByText('Enter your email.')).toBeHidden();
  await expect(page.getByText('Enter your password.')).toBeVisible();
});

test('answers a wrong password with one generic error', async ({ page, login }) => {
  await login('test@example.com', 'not-the-password');
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
  await expect(page).toHaveURL(/\/login$/);
});

test('signs in, lands on the links dashboard, and cannot reopen the login page', async ({ page, login }) => {
  await login();
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();

  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

test('returns to the requested page after sign-in', async ({ page }) => {
  await page.goto('/settings/account');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('test-password-12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
});
