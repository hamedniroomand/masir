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
  await createLink(page, { destinationUrl: 'https://example.com/menu', slug: 'menu-actions', title: 'Menu actions' });
  await page.goto('/');
  await rowMenu(page, 'Menu actions').click();
  for (const label of ['Edit link', 'View analytics', 'QR code', 'Open link'])
    await expect(page.getByRole('menuitem', { name: label })).toBeVisible();
});

test('disables and enables a link from the row menu', async ({ page, login }) => {
  await login();
  await createLink(page, { destinationUrl: 'https://example.com/toggle', slug: 'toggle-actions', title: 'Toggle actions' });
  await page.goto('/');
  const row = page.locator('article').filter({ has: page.getByRole('link', { name: 'Toggle actions', exact: true }) });
  await rowMenu(page, 'Toggle actions').click();
  await page.getByRole('menuitem', { name: 'Disable link' }).click();
  await expect(row.getByText('Disabled', { exact: true })).toBeVisible();

  await rowMenu(page, 'Toggle actions').click();
  await page.getByRole('menuitem', { name: 'Enable link' }).click();
  await expect(row.getByText('Active', { exact: true })).toBeVisible();
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

test('saves a note on the settings tab and shows it on the overview tab', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/noted', slug: 'noted', title: 'Noted link' });
  await page.goto(`/links/${link.id}?tab=settings`);
  await page.getByLabel('Notes').fill('Printed on the spring flyer.');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('Notes saved')).toBeVisible();

  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByText('Printed on the spring flyer.')).toBeVisible();
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

test('reveals the visit cap fallback once a cap is set and keeps it', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/prize', slug: 'capped', title: 'Capped' });
  await page.goto(`/links/${link.id}?tab=settings`);

  await expect(page.getByLabel('After the visit cap')).toHaveCount(0);
  await page.getByLabel('Maximum visits').fill('5');
  await expect(page.getByLabel('After the visit cap')).toBeVisible();

  await page.getByLabel('After the visit cap').fill('https://example.com/sold-out');
  await page.getByRole('button', { name: 'Save access settings' }).click();

  await page.reload();
  await expect(page.getByLabel('After the visit cap')).toHaveValue('https://example.com/sold-out');
});

test('saves and removes a targeting rule on the settings tab', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/app', slug: 'targeted-ui', title: 'Targeted' });
  await page.goto(`/links/${link.id}?tab=settings`);

  await page.getByLabel('Android destination').fill('https://example.com/play');
  await page.getByRole('button', { name: 'Add a country' }).click();
  await page.getByLabel('Country code 1').fill('US');
  await page.getByLabel('Country destination 1').fill('https://example.com/us');
  await page.getByRole('button', { name: 'Save targeting' }).click();
  await expect(page.getByText('Targeting saved')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Android destination')).toHaveValue('https://example.com/play');
  await expect(page.getByLabel('Country code 1')).toHaveValue('US');

  await page.getByRole('button', { name: 'Remove country rule 1' }).click();
  await page.getByRole('button', { name: 'Save targeting' }).click();
  await page.reload();
  await expect(page.getByLabel('Country code 1')).toHaveCount(0);
  await expect(page.getByLabel('Android destination')).toHaveValue('https://example.com/play');
});

test('renames a slug and keeps the old address as an alias', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/renamed', slug: 'old-address', title: 'Renamed' });
  await page.goto(`/links/${link.id}?tab=settings`);

  await page.getByLabel('Short address').fill('new-address');
  await expect(page.getByLabel('Keep /old-address working as an alias')).toBeChecked();
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('button', { name: 'Remove the address old-address' })).toBeVisible();
  expect((await page.request.get('/old-address', { maxRedirects: 0 })).headers().location).toBe('https://example.com/renamed');
  expect((await page.request.get('/new-address', { maxRedirects: 0 })).headers().location).toBe('https://example.com/renamed');
});

test('adds and removes an extra address', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/extra', slug: 'extra-main', title: 'Extra' });
  await page.goto(`/links/${link.id}?tab=settings`);

  await page.getByLabel('New address').fill('extra-alias');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove the address extra-alias' })).toBeVisible();
  expect((await page.request.get('/extra-alias', { maxRedirects: 0 })).headers().location).toBe('https://example.com/extra');

  await page.getByRole('button', { name: 'Remove the address extra-alias' }).click();
  await expect(page.getByRole('button', { name: 'Remove the address extra-alias' })).toHaveCount(0);
  expect((await page.request.get('/extra-alias', { maxRedirects: 0 })).status()).toBe(404);
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
  await expect(page.getByRole('heading', { name: 'Link activity' })).toBeVisible();
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
  await createLink(page, { destinationUrl: 'https://example.com/qr-open', slug: 'qr-open', title: 'QR open' });
  await page.goto('/');
  await rowMenu(page, 'QR open').click();
  await page.getByRole('menuitem', { name: 'QR code' }).click();
  await expect(page.getByRole('dialog').getByText('Share offline')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'QR open', exact: true }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  await expect(page.getByRole('dialog').getByText('Share offline')).toBeVisible();
});

// The panel offers no size control, so the format is the only choice a user
// makes here. The preview size is a prop, not a field.
test('downloads the QR code in both formats', async ({ page, login }) => {
  await login();
  const link = await createLink(page, { destinationUrl: 'https://example.com/qr-download', slug: 'qr-download', title: 'QR download' });
  await page.goto('/');
  await page.getByRole('link', { name: 'QR download', exact: true }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  const panel = page.getByRole('dialog');

  const png = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'PNG', exact: true }).click();
  expect((await png).suggestedFilename()).toBe(`masir-${link.id}.png`);

  const svg = page.waitForEvent('download');
  await panel.getByRole('link', { name: 'SVG', exact: true }).click();
  expect((await svg).url()).toContain(`format=svg`);
});

test('carries the chosen QR colour into the preview and remembers it', async ({ page, login }) => {
  await login();
  await createLink(page, { destinationUrl: 'https://example.com/qr-colour', slug: 'qr-colour', title: 'QR colour' });
  await createLink(page, { destinationUrl: 'https://example.com/qr-colour-next', slug: 'qr-colour-next', title: 'QR colour next' });
  await page.goto('/');
  await page.getByRole('link', { name: 'QR colour', exact: true }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  const panel = page.getByRole('dialog');

  await panel.getByLabel('QR foreground colour').fill('#ff0000');
  await expect(panel.getByRole('img', { name: 'QR code for short link' })).toHaveAttribute('src', /fg=ff0000/);
  await expect(panel.getByRole('link', { name: 'SVG', exact: true })).toHaveAttribute('href', /fg=ff0000/);

  // The choice lives in this browser, so another link starts with it.
  await page.goto('/');
  await page.getByRole('link', { name: 'QR colour next', exact: true }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  await expect(page.getByRole('dialog').getByRole('img', { name: 'QR code for short link' })).toHaveAttribute('src', /fg=ff0000/);
});
