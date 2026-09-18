import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  const { userId } = db.reset();
  db.insertWorkspace({ slug: 'beta', name: 'Beta', ownerUserId: userId });
});

test('renames the workspace', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/settings/workspace`);
  await page.getByLabel('Workspace name').fill('Acme Rebranded');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Workspace name')).toHaveValue('Acme Rebranded');
});

test('keeps the workspace when the delete is cancelled', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/settings/workspace`);
  await page.getByRole('button', { name: 'Delete workspace' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Delete workspace' })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Workspace name')).toHaveValue('Acme Rebranded');
});

// Last in the file: the workspace it deletes is the one the others rename.
test('deletes a workspace and its address stops resolving', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/settings/workspace`);
  await page.getByRole('button', { name: 'Delete workspace' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page).not.toHaveURL(/\/settings\/workspace$/);

  const response = await page.goto(`${server.hostUrl('acme')}/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Workspace not found.' })).toBeVisible();

  await page.goto(`${server.hostUrl('beta')}/`);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});
