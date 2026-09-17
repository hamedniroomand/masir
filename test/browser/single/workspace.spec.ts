import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
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
