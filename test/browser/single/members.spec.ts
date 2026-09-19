import { expect, test } from '../fixtures';

const MATE = 'mate@example.com';
const MATE_PASSWORD = 'mate-password-12345';
const GUEST = 'guest@example.com';
const HEIR = 'heir@example.com';

let workspaceId = '';

// A member joins through an invitation in invite.spec.ts. This file drives the
// controls that act on a member who is already here, so it seeds the row.
test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  const mate = db.insertUser({ email: MATE, password: MATE_PASSWORD });
  db.insertMember({ workspaceId, userId: mate });
});

function memberRow(page: import('@playwright/test').Page, email: string) {
  return page.getByRole('listitem').filter({ hasText: email });
}

test('offers no controls on the owner row', async ({ page, login }) => {
  await login();
  await page.goto('/settings/members');
  const owner = memberRow(page, 'test@example.com');
  await expect(owner).toContainText('Owner');
  await expect(owner.getByRole('button')).toHaveCount(0);
});

test('deactivates a member and brings them back', async ({ page, login }) => {
  await login();
  await page.goto('/settings/members');
  await memberRow(page, MATE).getByRole('button', { name: 'Deactivate' }).click();
  await expect(memberRow(page, MATE)).toContainText('Deactivated');

  await memberRow(page, MATE).getByRole('button', { name: 'Reactivate' }).click();
  await expect(memberRow(page, MATE)).not.toContainText('Deactivated');
});

test('reports the reason when an action is refused', async ({ page, login }) => {
  await login();
  await page.goto('/settings/members');
  await memberRow(page, MATE).getByRole('button', { name: 'Deactivate' }).click();
  await expect(memberRow(page, MATE)).toContainText('Deactivated');

  // Ownership may not move to somebody who cannot use the workspace.
  await memberRow(page, MATE).getByRole('button', { name: 'Make owner' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Transfer ownership' }).click();
  await expect(page.getByRole('alert')).toHaveText('Reactivate this member before you transfer ownership.');
  await memberRow(page, MATE).getByRole('button', { name: 'Reactivate' }).click();
});

test('resends and revokes a pending invitation', async ({ page, login, db }) => {
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill(GUEST);
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('Pending invitations')).toBeVisible();
  expect(db.mailCount(GUEST)).toBe(1);

  await memberRow(page, GUEST).getByRole('button', { name: 'Resend' }).click();
  await expect.poll(() => db.mailCount(GUEST)).toBe(2);

  await memberRow(page, GUEST).getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('Pending invitations')).toHaveCount(0);
});

test('asks before it removes a member', async ({ page, login }) => {
  await login();
  await page.goto('/settings/members');
  await memberRow(page, MATE).getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(memberRow(page, MATE)).toHaveCount(1);

  await memberRow(page, MATE).getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove member' }).click();
  await expect(memberRow(page, MATE)).toHaveCount(0);
});

// Last in the file: the owner gives the role away, so nothing after it can act.
test('transfers ownership after a confirmation and sends the former owner to the dashboard', async ({ page, login, db, browser, server }) => {
  await login();
  const heir = db.insertUser({ email: HEIR, password: MATE_PASSWORD });
  db.insertMember({ workspaceId, userId: heir });

  await page.goto('/settings/members');
  await memberRow(page, HEIR).getByRole('button', { name: 'Make owner' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(HEIR);
  await dialog.getByRole('button', { name: 'Transfer ownership' }).click();

  // The former owner cannot open this page any more, so it leaves on its own.
  await expect(page.getByRole('heading', { name: /All links/ })).toBeVisible();
  await expect(page.getByText('Ownership transferred. You are now a member.', { exact: true })).toBeVisible();

  // The admin nav follows the role, so the former owner loses it.
  await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Workspace' })).toHaveCount(0);

  const newOwner = await browser.newPage({ baseURL: server.baseURL });
  await newOwner.goto('/login');
  await newOwner.getByLabel('Email').fill(HEIR);
  await newOwner.getByLabel('Password').fill(MATE_PASSWORD);
  await newOwner.getByRole('button', { name: 'Sign in' }).click();
  await expect(newOwner.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await newOwner.goto('/settings/members');
  await expect(memberRow(newOwner, HEIR)).toContainText('Owner');
  await newOwner.close();
});
