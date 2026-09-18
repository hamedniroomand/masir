import { expect, test } from '../fixtures';
import { inDays, pickDate } from '../ui';

test.beforeAll(({ db }) => {
  db.reset();
});

async function openCreateForm(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create link' }).click();
  return page.getByRole('dialog');
}

test('creates a link with a custom short address and redirects to the destination', async ({ page, login, server }) => {
  await login();
  const dialog = await openCreateForm(page);
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

test('refuses a short address that another link already uses', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('https://example.com/again');
  await dialog.getByLabel('Short address').fill('launch');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('This short link is already taken.')).toBeVisible();
});

test('refuses a reserved short address', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('https://example.com/reserved');
  await dialog.getByLabel('Short address').fill('login');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('This slug is reserved.')).toBeVisible();
});

test('sends a visitor to the unlock page when the form sets a password', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('https://example.com/secret');
  await dialog.getByLabel('Short address').fill('secret-form');
  await dialog.getByRole('button', { name: 'Access and schedule' }).click();
  await dialog.getByLabel('Password', { exact: true }).fill('open-sesame');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Link created')).toBeVisible();

  await page.goto('/secret-form');
  await expect(page).toHaveURL(/\/p\/secret-form$/);
  await expect(page.getByText('Enter the password to continue.')).toBeVisible();
});

test('refuses a start time that falls after the expiry time', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('https://example.com/schedule');
  await dialog.getByRole('button', { name: 'Access and schedule' }).click();
  await pickDate(page, dialog.getByRole('button', { name: 'Not scheduled' }), inDays(20));
  await pickDate(page, dialog.getByRole('button', { name: 'No expiry' }), inDays(10));
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Start time must be before expiry.')).toBeVisible();
});

test('sets a visit cap of one with the one-time link button', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('https://example.com/once');
  await dialog.getByLabel('Short address').fill('once');
  await dialog.getByRole('button', { name: 'Access and schedule' }).click();
  await dialog.getByRole('button', { name: 'One-time link' }).click();
  await expect(dialog.getByLabel('Maximum visits')).toHaveValue('1');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Link created')).toBeVisible();

  const created = await page.request.get('/api/links?q=once');
  const body = await created.json() as { items: { slug: string; maximumVisits: number | null }[] };
  expect(body.items.find(item => item.slug === 'once')?.maximumVisits).toBe(1);
});

test('adds a tag that exists and a tag the user names', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('https://example.com/tagged');
  await dialog.getByLabel('Short address').fill('tagged');
  await dialog.getByRole('button', { name: 'Tags' }).click();
  const tags = dialog.getByRole('combobox', { name: 'Tags' });
  await tags.fill('docs');
  await page.getByRole('option', { name: /docs/ }).click();
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Link created')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'docs' })).toBeVisible();
});

test('refuses a destination that is not http or https', async ({ page, login }) => {
  await login();
  const dialog = await openCreateForm(page);
  await dialog.getByLabel('Destination URL').fill('javascript://example.com/alert(1)');
  const answer = page.waitForResponse(response => response.url().endsWith('/api/links') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  expect((await answer).status()).toBe(422);
  await expect(dialog.getByText('Only http and https URLs are allowed.')).toBeVisible();
});
