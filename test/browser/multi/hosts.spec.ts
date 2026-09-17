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
  await expect(page.getByText('Workspace not found')).toBeVisible();
});
