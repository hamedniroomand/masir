import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('prefills the create form from the query and lands on the new link', async ({ page, login }) => {
  await login();
  await page.goto('/links/new?url=https%3A%2F%2Fexample.com%2Fread&title=A%20good%20read');

  await expect(page.getByLabel('Destination URL')).toHaveValue('https://example.com/read');
  await expect(page.getByLabel('Title')).toHaveValue('A good read');

  await page.getByRole('button', { name: 'Create link' }).click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
});

test('sends a signed-out visitor to login and back with the query', async ({ page }) => {
  await page.goto('/links/new?url=https%3A%2F%2Fexample.com%2Flater&title=Later');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  expect(decodeURIComponent(page.url())).toContain('/links/new?url=https://example.com/later');
});

test('shows the field error for a url that is not http', async ({ page, login }) => {
  await login();
  await page.goto('/links/new?url=javascript%3Aalert(1)');
  await page.getByRole('button', { name: 'Create link' }).click();
  await expect(page.getByText('Enter a valid URL.')).toBeVisible();
  await expect(page).toHaveURL(/\/links\/new/);
});

test('offers a bookmarklet that opens the create page', async ({ page, login }) => {
  await login();
  await page.goto('/settings/workspace');
  const bookmarklet = page.getByRole('link', { name: 'Shorten with Masir' });
  await expect(bookmarklet).toBeVisible();
  const href = await bookmarklet.getAttribute('href');
  expect(href).toMatch(/^javascript:/);
  expect(href).toContain('/links/new?url=');
});
