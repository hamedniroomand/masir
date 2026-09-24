import { expect, test } from '../fixtures';
import { chooseOption } from '../ui';

let workspaceId = '';
let campaignId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  campaignId = db.insertCampaign({ workspaceId, utmCampaign: 'bulk-ui', name: 'Bulk UI' });
  db.insertLink({ workspaceId, slug: 'bulk-one', title: 'Bulk One', campaignId });
  db.insertLink({ workspaceId, slug: 'bulk-two', title: 'Bulk Two', campaignId });
  db.insertLink({ workspaceId, slug: 'bulk-other', title: 'Bulk Other', tags: ['keep'] });
});

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('filters by campaign, selects all matching, and tags them in one action', async ({ page, login }) => {
  await login();
  await page.request.post('/api/tags', { data: { name: 'batched' } });
  await page.goto('/');

  await chooseOption(page, 'Filter links by campaign', 'Bulk UI');
  await expect(page.getByRole('article')).toHaveCount(2);

  await page.getByLabel('Select all links on this page').click();
  await expect(page.getByLabel('Bulk selection')).toContainText('2 on this page');

  await page.getByRole('button', { name: 'Select all 2 matching' }).click();
  await expect(page.getByLabel('Bulk selection')).toContainText('All 2 matching');

  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Acme');
  await chooseOption(page, 'Tag', 'batched');
  await dialog.getByRole('button', { name: 'Add tag', exact: true }).click();

  await expect(page.getByText('Updated 2 links.', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Bulk One' })).toContainText('batched');
  await expect(page.getByRole('article').filter({ hasText: 'Bulk Two' })).toContainText('batched');
});

test('keeps row copy and the row menu reachable with selection on', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Select Bulk One' }).click();
  await expect(page.getByLabel('Bulk selection')).toBeVisible();

  await page.getByRole('button', { name: 'Copy Bulk One' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Bulk One' }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit link' })).toBeVisible();
});
