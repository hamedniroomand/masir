import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('offers no workspace switcher with a single workspace', async ({ page, login }) => {
  await login();
  await page.getByRole('button', { name: /Account menu/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Switch workspace' })).toHaveCount(0);
});
