import { expect, test } from '../fixtures';

const EMAIL = 'cloud-founder@example.com';
const PASSWORD = 'cloud-founder-password';

// The resend only sends to an account that still waits, so it uses its own.
const WAITING = 'cloud-waiting@example.com';

test.beforeAll(({ db }) => {
  db.reset();
  db.insertUser({ email: WAITING, password: PASSWORD, verified: false });
});

test('registers a new account and verifies it from the emailed link', async ({ page, db, server }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Sign up with email instead' }).click();
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=/);
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

test('sends one more verification email and then disables the button', async ({ page, db }) => {
  await page.goto(`/verify-email?email=${encodeURIComponent(WAITING)}`);
  const resend = page.getByRole('button', { name: 'Resend email' });
  await expect(resend).toBeEnabled();

  await resend.click();
  await expect(page.getByText('We sent another link.')).toBeVisible();
  await expect(resend).toBeDisabled();
  expect(db.mailCount(WAITING)).toBe(1);
});
