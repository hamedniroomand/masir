import { expect, test } from '../fixtures';
import { chooseOption } from '../ui';

const VIEWER = 'viewer@example.com';
const VIEWER_PASSWORD = 'viewer-password-12345';
const MATE = 'rolemate@example.com';
const MATE_PASSWORD = 'rolemate-password-12345';

let workspaceId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  const viewer = db.insertUser({ email: VIEWER, password: VIEWER_PASSWORD });
  db.insertMember({ workspaceId, userId: viewer, role: 'viewer' });
  const mate = db.insertUser({ email: MATE, password: MATE_PASSWORD });
  db.insertMember({ workspaceId, userId: mate });
  db.insertLink({ workspaceId, slug: 'read-only', title: 'Read only' });
});

test('hides every create and edit control from a viewer', async ({ page, login }) => {
  await login(VIEWER, VIEWER_PASSWORD);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Read only', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create link' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Read only', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'History' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
});

test('keeps the settings tab away from a viewer who asks for it', async ({ page, login }) => {
  await login(VIEWER, VIEWER_PASSWORD);
  await page.goto('/');
  await page.getByRole('link', { name: 'Read only', exact: true }).click();
  await page.goto(`${page.url().split('?')[0]}?tab=settings`);
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByLabel('Destination URL')).toHaveCount(0);
});

test('changes a member to a viewer from the members page', async ({ page, login }) => {
  await login();
  await page.goto('/settings/members');
  const row = page.getByRole('listitem').filter({ hasText: MATE });
  await expect(row).toContainText('Member');
  await chooseOption(page, `Role for ${MATE}`, 'Viewer');
  await expect(row).toContainText('Viewer');
});

test('offers the create controls to an owner', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create link' })).toBeVisible();
});
