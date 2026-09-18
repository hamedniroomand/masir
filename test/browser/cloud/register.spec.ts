import { expect, test } from '../fixtures';

const EMAIL = 'cloud-founder@example.com';
const PASSWORD = 'cloud-founder-12345!';

test.beforeAll(({ db }) => {
  db.reset();
});

test('registers a new account and verifies it from the emailed link', async ({ page, db, server }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Sign up with email instead' }).click();
  await page.getByLabel('Email').fill(EMAIL);
  // The register field shares its label prefix with the show/hide button.
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  const token = db.lastToken(EMAIL);
  expect(token).toBeTruthy();
  await page.goto(`/verify-email?token=${token}`);
  await expect(page).toHaveURL(/\/workspaces\/new$/);

  await page.getByLabel('Company or workspace name').fill('Cloud Co');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/workspaces\/invite\?slug=cloud-co$/);

  await page.goto(server.hostUrl('cloud-co'));
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

test('refuses a password that breaks the account rules', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Sign up with email instead' }).click();
  await page.getByLabel('Email').fill('weak@example.com');
  await page.getByLabel(/^Password/).fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toHaveCount(0);
});
