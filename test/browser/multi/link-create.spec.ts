import { expect, test } from '../fixtures';

// The single-workspace server answers on localhost, and a localhost destination
// is refused as a private address before the self-reference check runs. Only a
// scenario with a public short domain reaches that check.
test.beforeAll(({ db }) => {
  db.reset();
});

test('refuses an expiration destination that points at the same short link', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/`);
  await page.getByRole('button', { name: 'Create link' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Destination URL').fill('https://example.com/loop');
  await dialog.getByLabel('Short address').fill('loop');
  await dialog.getByRole('button', { name: 'Access and schedule' }).click();
  await dialog.getByLabel('Expiration destination').fill(`${server.baseURL}/loop`);
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Expiration destination cannot point to this short link.')).toBeVisible();
});
