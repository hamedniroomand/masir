import { expect, test } from '../fixtures';

let userId = '';

// The sidebar is a list too, so the identities are read from the main region.
const methods = (page: import('@playwright/test').Page) => page.getByRole('main').getByRole('listitem');

test.beforeAll(({ db }) => {
  ({ userId } = db.reset());
});

test('lists the sign-in methods the account holds', async ({ page, login }) => {
  await login();
  await page.goto('/settings/account');
  await expect(page.getByRole('heading', { name: 'Sign-in methods' })).toBeVisible();
  await expect(methods(page)).toHaveCount(1);
  await expect(page.getByText('PASSWORD')).toBeVisible();
});

test('refuses to disconnect the only sign-in method', async ({ page, login }) => {
  await login();
  await page.goto('/settings/account');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page.getByRole('alert')).toHaveText('You cannot disconnect your only sign-in method.');
  await expect(methods(page)).toHaveCount(1);
});

test('disconnects one method while another remains', async ({ page, login, db }) => {
  db.insertIdentity({ userId, provider: 'google' });
  await login();
  await page.goto('/settings/account');
  await expect(methods(page)).toHaveCount(2);

  await methods(page).filter({ hasText: 'GOOGLE' }).getByRole('button', { name: 'Disconnect' }).click();
  await expect(methods(page)).toHaveCount(1);
  await expect(page.getByText('PASSWORD')).toBeVisible();
});

test('offers no provider buttons when the operator configured none', async ({ page, login }) => {
  await login();
  await page.goto('/settings/account');
  await expect(page.getByRole('link', { name: /^Connect / })).toHaveCount(0);
});
