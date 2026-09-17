import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('creates a link in the browser and its short address redirects', async ({ page, login, server }) => {
  await login();
  await page.getByRole('button', { name: 'Create link' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Destination URL').fill('https://example.com/launch');
  await dialog.getByLabel('Short address').fill('launch');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText(`${server.baseURL}/launch`)).toBeVisible();

  // The browser follows the redirect off our server, so ask for the answer
  // without following it.
  const response = await page.request.get('/launch', { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe('https://example.com/launch');
});

test('shows the visitor page for a link that does not exist', async ({ page }) => {
  const response = await page.goto('/no-such-link');
  expect(response?.status()).toBe(404);
});
