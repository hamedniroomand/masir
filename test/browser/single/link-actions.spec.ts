import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { inDays, pickDate } from '../ui';

// The clipboard button only flips after a real write, which needs the grant.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeAll(({ db }) => {
  db.reset();
});

type Created = { id: string; slug: string; shortUrl: string };

async function createLink(page: Page, body: Record<string, unknown>) {
  const response = await page.request.post('/api/links', { data: body });
  expect(response.status()).toBe(201);
  return await response.json() as Created;
}

function rowMenu(page: Page, name: string) {
  return page.getByRole('button', { name: `Actions for ${name}` });
}

test('flips the copy button to Copied', async ({ page, login }) => {
  await login();
  await createLink(page, { destinationUrl: 'https://example.com/copy', slug: 'copy-me', title: 'Copy me' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Copy Copy me' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
});

test('offers every link action in the row menu', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await rowMenu(page, 'Copy me').click();
  for (const label of ['Edit link', 'View analytics', 'QR code', 'Open link'])
    await expect(page.getByRole('menuitem', { name: label })).toBeVisible();
});

test('disables and enables a link from the row menu', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await rowMenu(page, 'Copy me').click();
  await page.getByRole('menuitem', { name: 'Disable link' }).click();
  await expect(page.getByText('Disabled', { exact: true })).toBeVisible();

  await rowMenu(page, 'Copy me').click();
  await page.getByRole('menuitem', { name: 'Enable link' }).click();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
});

test('deletes a link through the confirm modal and keeps its short address', async ({ page, login }) => {
  await login();
  await createLink(page, { destinationUrl: 'https://example.com/gone', slug: 'gone-soon', title: 'Gone soon' });
  await page.goto('/');
  await rowMenu(page, 'Gone soon').click();
  await page.getByRole('menuitem', { name: 'Delete link' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Gone soon')).toBeVisible();
  await modal.getByRole('button', { name: 'Delete link' }).click();
  await expect(page.getByRole('link', { name: 'Gone soon', exact: true })).toHaveCount(0);

  // A deleted link keeps its slug, so the address never points somewhere new.
  const again = await page.request.post('/api/links', { data: { destinationUrl: 'https://example.com/new', slug: 'gone-soon' } });
  expect(again.status()).toBe(409);
});

test('changes the destination on the settings tab and redirects to the new target', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/old', slug: 'moving', title: 'Moving target' });
  await page.goto(`/links/${link.id}?tab=settings`);
  await page.getByLabel('Destination URL').fill('https://example.com/new-home');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Destination saved')).toBeVisible();

  const response = await page.request.get('/moving', { maxRedirects: 0 });
  expect(response.headers().location).toBe('https://example.com/new-home');
});

test('saves a password, a schedule, and a visit cap from the access card', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/locked', slug: 'locked', title: 'Locked' });
  await page.goto(`/links/${link.id}?tab=settings`);

  await page.getByLabel('Password', { exact: true }).fill('let-me-in-12345');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByRole('button', { name: 'Remove password' })).toBeVisible();

  await pickDate(page, page.getByRole('button', { name: 'No expiry' }), inDays(9));
  await page.getByLabel('Maximum visits').fill('3');
  await page.getByRole('button', { name: 'Save access settings' }).click();

  await page.reload();
  await expect(page.getByLabel('Maximum visits')).toHaveValue('3');
  await expect(page.getByRole('button', { name: 'No expiry' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Remove limit' }).click();
  await page.getByRole('button', { name: 'Save access settings' }).click();
  await page.reload();
  await expect(page.getByLabel('Maximum visits')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Remove limit' })).toHaveCount(0);
});

test('shows the password badge on the link header', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await page.getByRole('link', { name: 'Locked', exact: true }).click();
  await expect(page.getByText('Password protected').first()).toBeVisible();
});

test('lists who created the link and what each edit changed on the history tab', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await page.getByRole('link', { name: 'Moving target', exact: true }).click();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('Created this link')).toBeVisible();
  await expect(page.getByText('Changed destination')).toBeVisible();
  await expect(page.getByText('test@example.com').first()).toBeVisible();
});

test('calls the api of a tab only once the tab is opened', async ({ page, login }) => {
  await login();
  const calls: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('/history') || pathname === '/api/campaigns')
      calls.push(pathname);
  });
  const link = await createLink(page, { destinationUrl: 'https://example.com/lazy', title: 'Lazy tabs' });
  await page.goto(`/links/${link.id}`);
  await expect(page.getByText('Link activity')).toBeVisible();
  expect(calls).toEqual([]);

  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Campaign and tracking')).toBeVisible();
  await expect.poll(() => calls).toEqual(['/api/campaigns']);

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('Created this link')).toBeVisible();
  expect(calls.filter(path => path.endsWith('/history'))).toHaveLength(1);
});

test('names who created the link in the detail header', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/who', title: 'Who made me' });
  await page.goto(`/links/${link.id}`);
  await expect(page.getByRole('link', { name: 'Test User' })).toHaveAttribute('href', 'mailto:test@example.com');
});

test('opens the QR slideover from the row and from the detail header', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await rowMenu(page, 'Copy me').click();
  await page.getByRole('menuitem', { name: 'QR code' }).click();
  await expect(page.getByRole('dialog').getByText('Share offline')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Copy me', exact: true }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  await expect(page.getByRole('dialog').getByText('Share offline')).toBeVisible();
});

// The panel offers no size control, so the format is the only choice a user
// makes here. The preview size is a prop, not a field.
test('downloads the QR code in both formats', async ({ page, login }) => {
  await login();
  await page.goto('/');
  await page.getByRole('link', { name: 'Copy me', exact: true }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  const panel = page.getByRole('dialog');

  for (const format of ['PNG', 'SVG']) {
    const download = page.waitForEvent('download');
    await panel.getByRole('link', { name: format, exact: true }).click();
    expect((await download).url()).toContain(`format=${format.toLowerCase()}`);
  }
});
