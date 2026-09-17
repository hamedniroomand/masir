import { expect, test } from '../fixtures';

const MATE = 'mate@example.com';
const MATE_PASSWORD = 'mate-password-12345';

test.beforeAll(({ db }) => {
  db.reset();
  db.insertUser({ email: MATE, password: MATE_PASSWORD });
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
  await expect(invitee.getByRole('heading', { name: /All links/ })).toBeVisible();
  await invitee.close();

  await page.reload();
  await expect(page.getByText(MATE)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
});
