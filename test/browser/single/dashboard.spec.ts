import { expect, test } from '../fixtures';

let workspaceId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  const linkId = db.insertLink({ workspaceId, slug: 'dash-top', title: 'Dashboard top' });
  db.insertClicks({ workspaceId, linkId, count: 3 });
  db.insertLink({ workspaceId, slug: 'dash-other', title: 'Dashboard other' });
});

test('lands on the overview after sign-in and opens a top link', async ({ page, login }) => {
  await login();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Clicks', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Dashboard top/ }).first().click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
});

test('keeps the link list on the root path and its search', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'All links' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard other', exact: true })).toBeVisible();

  await page.goto('/?q=dash-top');
  await expect(page.getByRole('link', { name: 'Dashboard top', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard other', exact: true })).toHaveCount(0);
});
