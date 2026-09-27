import { expect, test } from '../fixtures';

const PASSWORD = 'open-the-door-12345';

// The destination points back at the test server, so the browser never leaves
// the machine and the query names the link that answered.
test.beforeAll(({ db, server }) => {
  const { workspaceId } = db.reset();
  db.insertLink({ workspaceId, slug: 'vault', password: PASSWORD, destinationUrl: `${server.baseURL}/login?via=vault` });
  db.insertLink({ workspaceId, slug: 'safe', password: PASSWORD, destinationUrl: `${server.baseURL}/login?via=safe` });
});

test('opens the destination when the password is right', async ({ page, server }) => {
  await page.goto('/vault');
  await expect(page).toHaveURL(url => url.pathname === '/p/vault' && url.searchParams.get('path') === '/vault');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(`${server.baseURL}/login?via=vault`);
});

test('lets the visitor through again inside the grant window', async ({ page, server }) => {
  await page.goto('/vault');
  await expect(page).toHaveURL(url => url.pathname === '/p/vault' && url.searchParams.get('path') === '/vault');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(`${server.baseURL}/login?via=vault`);

  // The grant is a cookie for this link, so the second visit skips the prompt.
  await page.goto('/vault');
  await expect(page).toHaveURL(`${server.baseURL}/login?via=vault`);
});

test('refuses a wrong password', async ({ page }) => {
  await page.goto('/p/safe');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect password.');
});

test('tells the visitor that an unknown short address does not exist', async ({ page }) => {
  await page.goto('/p/nothing-here');
  await expect(page.getByText('Link not found')).toBeVisible();
  await expect(page.getByText('This short link does not exist.')).toBeVisible();
});

// Last in the file: it spends the whole minute of attempts for this address.
test('stops a visitor who keeps guessing', async ({ page }) => {
  await page.goto('/p/safe');
  for (let attempt = 0; attempt < 10; attempt++)
    await page.request.post('/api/links/verify-password', { data: { slug: 'safe', password: 'wrong' } });

  await page.getByLabel('Password').fill('wrong-again');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('Too many attempts. Try again later.');
});
