import { expect, test } from '../fixtures';

const EMAIL = 'founder@example.com';
const PASSWORD = 'founder-password-12345';
// The resend only sends to an account that still waits, so it uses its own.
const WAITING = 'waiting@example.com';

test.beforeAll(({ db }) => {
  db.reset();
  db.insertUser({ email: WAITING, password: PASSWORD, verified: false });
});

test('registers, verifies the email, creates a workspace, and reaches its subdomain', async ({ page, db, server }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=/);
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  const token = db.lastToken(EMAIL);
  expect(token).toBeTruthy();
  await page.goto(`/verify-email?token=${token}`);
  // Verified and signed in, but without a workspace, so the shell sends the
  // person to create one.
  await expect(page).toHaveURL(/\/workspaces\/new$/);

  await page.getByLabel('Company or workspace name').fill('Zeta Corp');
  await expect(page.getByLabel('Workspace address')).toHaveValue('zeta-corp');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/workspaces\/invite\?slug=zeta-corp$/);
  await expect(page.getByRole('heading', { name: 'Invite your team' })).toBeVisible();

  // The session cookie carries the parent domain, so the subdomain is signed in.
  await page.goto(server.hostUrl('zeta-corp'));
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

test('offers no sign-in provider when the operator configured none', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: /Continue with/ })).toHaveCount(0);
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('refuses a verification link a second time', async ({ page, db }) => {
  const token = db.lastToken(EMAIL);
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole('alert')).toContainText('not valid');
});

test('lands a user with one workspace in it and skips the selector', async ({ page, login, server }) => {
  await login(EMAIL, PASSWORD);
  await expect(page).toHaveURL(`${server.hostUrl('zeta-corp')}/`);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

test('sends the invitations the onboarding step collects', async ({ page, login, db, server }) => {
  await login(EMAIL, PASSWORD);
  await page.goto(`${server.hostUrl('zeta-corp')}/workspaces/invite?slug=zeta-corp`);
  await page.getByPlaceholder('teammate@example.com').first().fill('crew@example.com');
  await page.getByRole('button', { name: 'Send invites' }).click();
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
  expect(db.mailCount('crew@example.com')).toBe(1);
});

test('ends onboarding when the invite step is skipped', async ({ page, login, server }) => {
  await login(EMAIL, PASSWORD);
  await page.goto(`${server.hostUrl('zeta-corp')}/workspaces/invite?slug=zeta-corp`);
  await page.getByRole('link', { name: 'Skip for now' }).click();
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

test('sends one more verification email and then disables the button', async ({ page, db }) => {
  await page.goto(`/verify-email?email=${encodeURIComponent(WAITING)}`);
  const resend = page.getByRole('button', { name: 'Resend email' });
  await resend.click();
  await expect(page.getByText('We sent another link.')).toBeVisible();
  await expect(resend).toBeDisabled();
  expect(db.mailCount(WAITING)).toBe(1);
});
