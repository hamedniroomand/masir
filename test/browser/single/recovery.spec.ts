import { expect, OWNER_EMAIL, test } from '../fixtures';

const ANSWER = 'If an account exists for this email, we sent a recovery link.';
const NEW_PASSWORD = 'a-brand-new-12345!';

test.beforeAll(({ db }) => {
  db.reset();
});

test('answers an unknown address the same way as a known one', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByRole('button', { name: 'Send recovery link' }).click();
  await expect(page.getByText(ANSWER)).toBeVisible();
});

test('sets a new password from the emailed link and signs in with it', async ({ page, db, login }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(OWNER_EMAIL);
  await page.getByRole('button', { name: 'Send recovery link' }).click();
  await expect(page.getByText(ANSWER)).toBeVisible();

  const token = db.lastToken(OWNER_EMAIL);
  expect(token).toBeTruthy();
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/^New password/).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(OWNER_EMAIL, NEW_PASSWORD);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();

  // A recovery link is spent once it is used.
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/^New password/).fill('another-password-9!');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByRole('alert')).toHaveText('This recovery link is not valid. Ask for a new one.');
});
