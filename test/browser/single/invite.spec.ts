import { expect, test } from '../fixtures';

const MATE = 'mate@example.com';
const MATE_PASSWORD = 'mate-password-12345';
const STRANGER = 'stranger@example.com';

test.beforeAll(({ db }) => {
  db.reset();
  db.insertUser({ email: MATE, password: MATE_PASSWORD });
  db.insertUser({ email: STRANGER, password: MATE_PASSWORD });
});

test('invites a teammate who joins through the emailed link', async ({ page, login, db, browser, server }) => {
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill(MATE);
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText(MATE)).toBeVisible();

  const token = db.lastToken(MATE);
  expect(token).toBeTruthy();

  // The invitee arrives signed out. The token must survive the sign-in.
  const invitee = await browser.newPage({ baseURL: server.baseURL });
  await invitee.goto(`/invite?token=${token}`);
  await expect(invitee).toHaveURL(/\/login\?redirect=/);
  await invitee.getByLabel('Email').fill(MATE);
  await invitee.getByLabel('Password').fill(MATE_PASSWORD);
  await invitee.getByRole('button', { name: 'Sign in' }).click();
  await invitee.getByRole('button', { name: 'Join the workspace' }).click();
  await expect(invitee.getByRole('heading', { name: /Overview/ })).toBeVisible();
  await invitee.close();

  await page.reload();
  await expect(page.getByText(MATE)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
});

test('hides the workspace pages from a member', async ({ page, login }) => {
  await login(MATE, MATE_PASSWORD);
  await expect(page.getByRole('link', { name: 'All links' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Workspace' })).toHaveCount(0);

  // The API is the guard. A member who types the address reads nothing.
  for (const path of ['/api/workspaces/members', '/api/workspaces/invitations']) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(404);
  }
});

test('refuses an invitation that names another address', async ({ page, login, db, browser, server }) => {
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill('someone-else@example.com');
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('someone-else@example.com')).toBeVisible();
  const token = db.lastToken('someone-else@example.com');

  // A second context, because the owner is signed in on this one.
  const stranger = await browser.newPage({ baseURL: server.baseURL });
  await stranger.goto('/login');
  await stranger.getByLabel('Email').fill(STRANGER);
  await stranger.getByLabel('Password').fill(MATE_PASSWORD);
  await stranger.getByRole('button', { name: 'Sign in' }).click();
  await stranger.waitForURL(url => !url.pathname.startsWith('/login'));
  await stranger.goto(`/invite?token=${token}`);
  await stranger.getByRole('button', { name: 'Join the workspace' }).click();
  await expect(stranger.getByRole('alert')).toHaveText('This invitation belongs to another email address.');
  await stranger.close();
});

test('refuses a revoked invitation', async ({ page, login, db }) => {
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill('revoked@example.com');
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('revoked@example.com')).toBeVisible();
  const token = db.lastToken('revoked@example.com');

  const row = page.getByRole('listitem').filter({ hasText: 'revoked@example.com' });
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(row).toHaveCount(0);

  await page.goto(`/invite?token=${token}`);
  await expect(page.getByRole('alert')).toHaveText('This invitation is not valid.');
});

test('creates an account for a new teammate from the invite link', async ({ page, login, db, browser, server }) => {
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill('newbie@example.com');
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('newbie@example.com')).toBeVisible();
  const token = db.lastToken('newbie@example.com');

  const invitee = await browser.newPage({ baseURL: server.baseURL });
  await invitee.goto(`/invite?token=${token}`);
  await expect(invitee.getByText('newbie@example.com')).toBeVisible();
  await invitee.getByLabel('Password').fill('newbie-password-1!');
  await invitee.getByRole('button', { name: 'Join the workspace' }).click();
  await expect(invitee.getByRole('heading', { name: /Overview/ })).toBeVisible();
  await invitee.close();
});

test('keeps the token through sign-in for an existing account', async ({ page, login, db, browser, server }) => {
  db.insertUser({ email: 'returning@example.com', password: MATE_PASSWORD });
  await login();
  await page.goto('/settings/members');
  await page.getByPlaceholder('teammate@example.com').fill('returning@example.com');
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('returning@example.com')).toBeVisible();
  const token = db.lastToken('returning@example.com');

  const invitee = await browser.newPage({ baseURL: server.baseURL });
  await invitee.goto(`/invite?token=${token}`);
  await expect(invitee).toHaveURL(new RegExp(`redirect=${encodeURIComponent(`/invite?token=${token}`)}`));
  await invitee.getByLabel('Email').fill('returning@example.com');
  await invitee.getByLabel('Password').fill(MATE_PASSWORD);
  await invitee.getByRole('button', { name: 'Sign in' }).click();
  await invitee.getByRole('button', { name: 'Join the workspace' }).click();
  await expect(invitee.getByRole('heading', { name: /Overview/ })).toBeVisible();
  await invitee.close();
});
