import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

// Eight signature bytes and padding are enough for the byte check.
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array.from({ length: 24 }).fill(0) as number[]]);

test('uploads, shows, and removes the workspace logo', async ({ page, login }) => {
  await login();
  await page.goto('/settings/workspace');
  // No logo yet, so the avatar shows the first letter of the name.
  await expect(page.getByText('A', { exact: true })).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload logo' }).click();
  await (await chooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });

  const logo = page.getByRole('img', { name: 'Acme logo' });
  await expect(logo).toHaveAttribute('src', /\/uploads\/logos\//);
  await expect(page.getByRole('button', { name: 'Replace logo' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'Upload logo' })).toBeVisible();
  await expect(page.getByText('A', { exact: true })).toBeVisible();
});

test('refuses a second workspace on a single-workspace instance', async ({ page, login }) => {
  await login();
  await page.goto('/workspaces/new');
  await page.getByLabel('Company or workspace name').fill('Second Team');
  await expect(page.getByLabel('Workspace address')).toHaveValue('second-team');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('alert')).toHaveText('This instance holds one workspace.');
});

test('offers no workspace deletion', async ({ page, login }) => {
  await login();
  await page.goto('/settings/workspace');
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete workspace' })).toHaveCount(0);
});
