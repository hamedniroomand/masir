import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

// A real 1x1 image. A signature with padding passes the byte check, but the
// browser cannot decode it, and the avatar then falls back to the initial.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

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
