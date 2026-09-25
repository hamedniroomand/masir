import { expect, test } from '../fixtures';

// Destinations point back at the root host so the browser never leaves the
// machine, and the query names the workspace that answered.
test.beforeAll(({ db, server }) => {
  const { userId, workspaceId } = db.reset();
  const beta = db.insertWorkspace({ slug: 'beta', name: 'Beta', ownerUserId: userId });
  db.insertLink({ workspaceId, slug: 'pricing', destinationUrl: `${server.baseURL}/login?via=acme` });
  db.insertLink({ workspaceId: beta, slug: 'pricing', destinationUrl: `${server.baseURL}/login?via=beta` });
});

test('offers a choice of workspaces after sign-in and lands on the chosen subdomain', async ({ page, login, server }) => {
  await login();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole('heading', { name: 'Choose workspace' })).toBeVisible();
  await page.getByRole('link', { name: /Acme/ }).click();
  await expect(page).toHaveURL(`${server.hostUrl('acme')}/`);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

test('resolves the same slug to a different link on each workspace host', async ({ page, server }) => {
  await page.goto(`${server.hostUrl('acme')}/pricing`);
  await expect(page).toHaveURL(`${server.baseURL}/login?via=acme`);
  await page.goto(`${server.hostUrl('beta')}/pricing`);
  await expect(page).toHaveURL(`${server.baseURL}/login?via=beta`);
});

test('serves no short links on the root host', async ({ page }) => {
  const response = await page.goto('/pricing');
  expect(response?.status()).toBe(404);
});

test('answers 404 for a subdomain that names no workspace', async ({ page, server }) => {
  const response = await page.goto(`${server.hostUrl('nobody')}/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Workspace not found.' })).toBeVisible();
});

// A reserved label is never a workspace, so the host serves the root site. A
// 404 there would take out www and api for every operator.
test('serves the root site on a reserved subdomain', async ({ page, server }) => {
  for (const label of ['www', 'api']) {
    const response = await page.goto(`${server.hostUrl(label)}/login`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  }
});

test('moves to another workspace from the sidebar and stays signed in', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('acme')}/`);
  await page.getByRole('button', { name: 'Switch workspace, currently Acme' }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Acme' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemcheckbox', { name: 'Beta' }).click();
  await expect(page).toHaveURL(`${server.hostUrl('beta')}/`);
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
});

// The shell must follow the host, not the first membership in the list. A
// wrong pick shows one workspace and edits another.
test('shows the workspace the host names, not the first membership', async ({ page, login, server }) => {
  await login();
  await page.goto(`${server.hostUrl('beta')}/settings/workspace`);
  await expect(page.getByRole('button', { name: 'Switch workspace, currently Beta' })).toBeVisible();
  await expect(page.getByLabel('Workspace name')).toHaveValue('Beta');
  await expect(page.getByLabel('Workspace address')).toHaveValue('beta');
});
