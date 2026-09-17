import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  const { userId } = db.reset();
  db.insertWorkspace({ slug: 'beta', name: 'Beta', ownerUserId: userId });
});

test('deletes a workspace and its address stops resolving', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/settings/workspace`);
  await page.getByRole('button', { name: 'Delete workspace' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page).not.toHaveURL(/\/settings\/workspace$/);

  const response = await page.goto(`${server.hostUrl('acme')}/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Workspace not found')).toBeVisible();

  await page.goto(`${server.hostUrl('beta')}/`);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});
