import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

async function openForm(page: import('@playwright/test').Page, name: string, slug?: string) {
  await page.goto('/workspaces/new');
  await page.getByLabel('Company or workspace name').fill(name);
  if (slug !== undefined)
    await page.getByLabel('Workspace address').fill(slug);
  await page.getByRole('button', { name: 'Create workspace' }).click();
}

test('suggests an address from the name and stops once the user types one', async ({ page, login }) => {
  await login();
  await page.goto('/workspaces/new');
  await page.getByLabel('Company or workspace name').fill('Gamma Works');
  await expect(page.getByLabel('Workspace address')).toHaveValue('gamma-works');

  // The address is immutable after creation, so a typed value must survive.
  await page.getByLabel('Workspace address').fill('gw');
  await page.getByLabel('Company or workspace name').fill('Gamma Works Limited');
  await expect(page.getByLabel('Workspace address')).toHaveValue('gw');
});

test('refuses a reserved address and names the reason', async ({ page, login }) => {
  await login();
  await openForm(page, 'Admin Team', 'admin');
  await expect(page.getByText('This workspace address is reserved.')).toBeVisible();
});

test('refuses an address another workspace already holds', async ({ page, login }) => {
  await login();
  await openForm(page, 'Second Acme', 'acme');
  await expect(page.getByRole('alert')).toHaveText('This workspace address is taken.');
});

test('reports a malformed address instead of correcting it', async ({ page, login }) => {
  await login();
  await openForm(page, 'Odd Name', 'Not A Slug!');
  await expect(page.getByText('The workspace address may only use lowercase letters, numbers, and hyphens.')).toBeVisible();
  await expect(page.getByLabel('Workspace address')).toHaveValue('Not A Slug!');
});
