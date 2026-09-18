import { expect, test } from '../fixtures';

const PENDING = 'pending@example.com';
const GUEST = 'guest-pending@example.com';
const PASSWORD = 'pending-password-12345';

// Registration is off here, so the unverified accounts are seeded. What the
// shell shows and what it refuses is the same in every shape.
test.beforeAll(({ db }) => {
  const { workspaceId } = db.reset();
  const userId = db.insertUser({ email: PENDING, password: PASSWORD, verified: false });
  db.insertMember({ workspaceId, userId });
  db.insertUser({ email: GUEST, password: PASSWORD, verified: false });
});

test('marks an unverified account and refuses a new workspace', async ({ page, login }) => {
  await login(PENDING, PASSWORD);
  await expect(page.getByText('Email not verified')).toBeVisible();

  const response = await page.request.post('/api/workspaces', { data: { name: 'Nope', slug: 'nope-team' } });
  expect(response.status()).toBe(403);
  expect((await response.json()).statusMessage).toBe('Verify your email before you make a workspace.');
});

test('refuses an unverified invitee at the invitation', async ({ page, login, db, browser, server }) => {
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill(GUEST);
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText(GUEST)).toBeVisible();
  const token = db.lastToken(GUEST);

  const guest = await browser.newPage({ baseURL: server.baseURL });
  await guest.goto('/login');
  await guest.getByLabel('Email').fill(GUEST);
  await guest.getByLabel('Password').fill(PASSWORD);
  await guest.getByRole('button', { name: 'Sign in' }).click();
  await guest.waitForURL(url => !url.pathname.startsWith('/login'));
  await guest.goto(`/invite?token=${token}`);
  await expect(guest.getByRole('alert')).toHaveText('Verify your email before you accept an invitation.');
  await guest.close();
});
