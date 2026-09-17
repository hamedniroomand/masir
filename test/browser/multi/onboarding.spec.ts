import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures';

const EMAIL = 'founder@example.com';
const PASSWORD = 'founder-password-12345';
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array.from({ length: 24 }).fill(0) as number[]]);

test.beforeAll(({ db }) => {
  db.reset();
});

test('registers, verifies the email, creates a workspace, and reaches its subdomain', async ({ page, db, server }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill(EMAIL);
  // The register field shares its label prefix with the show/hide button.
  await page.getByLabel(/^Password/).fill(PASSWORD);
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
  // The logo is picked before the workspace exists and uploaded right after.
  await expect(page.getByText('Z', { exact: true })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload logo' }).click();
  await (await chooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/workspaces\/invite\?slug=zeta-corp$/);
  await expect(page.getByRole('heading', { name: 'Invite your team' })).toBeVisible();

  // The session cookie carries the parent domain, so the subdomain is signed in.
  await page.getByRole('link', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(`${server.hostUrl('zeta-corp')}/`);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();

  await page.goto(`${server.hostUrl('zeta-corp')}/settings/workspace`);
  await expect(page.getByRole('img', { name: 'Zeta Corp logo' })).toHaveAttribute('src', /\/uploads\/logos\//);
});

test('sends the root host straight to the only workspace', async ({ page, login, server }) => {
  await login(EMAIL, PASSWORD);
  await expect(page).toHaveURL(`${server.hostUrl('zeta-corp')}/`);
  await page.goto('/');
  await expect(page).toHaveURL(`${server.hostUrl('zeta-corp')}/`);
});

test('refuses a verification link a second time', async ({ page, db }) => {
  const token = db.lastToken(EMAIL);
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole('alert')).toContainText('not valid');
});
