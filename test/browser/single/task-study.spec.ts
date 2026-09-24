import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures';

let workspaceId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  db.insertCampaign({ workspaceId, utmCampaign: 'r2-study', name: 'R2 study' });
});

test('creates newsletter, social, and print links from campaign detail', async ({ page, login }) => {
  await login();
  await page.goto('/campaigns');
  await page.getByRole('link', { name: /R2 study/ }).click();
  await page.getByRole('button', { name: 'Create link in this campaign' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Create a link' })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Campaign' })).toContainText('R2 study');
  await expect(dialog.getByRole('textbox', { name: 'Campaign', exact: true })).toHaveValue('r2-study');

  for (const channel of [
    { source: 'newsletter', medium: 'email' },
    { source: 'twitter', medium: 'social' },
    { source: 'print', medium: 'print' },
  ]) {
    if (await dialog.getByRole('button', { name: 'Create another' }).count())
      await dialog.getByRole('button', { name: 'Create another' }).click();
    await dialog.getByLabel('Destination URL').fill('https://example.com/r2-study');
    await dialog.getByLabel('Source').fill(channel.source);
    await dialog.getByLabel('Medium').fill(channel.medium);
    await expect(dialog.getByText(new RegExp(`utm_source=${channel.source}&utm_medium=${channel.medium}&utm_campaign=r2-study`))).toBeVisible();
    const response = page.waitForResponse(response => response.url().endsWith('/api/links') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create link', exact: true }).click();
    expect((await response).status()).toBe(201);
    await expect(dialog.getByText('Link created')).toBeVisible();
  }
});

test('imports CSV rows and retries only the failed row', async ({ page, login }) => {
  await login();
  await page.goto('/links/import');

  const csv = [
    'slug,destination_url,title',
    'study-ok,https://example.com/study-ok,Study OK',
    'study-retry,https://example.com/study-retry,Study Retry',
  ].join('\n');
  await page.locator('#import-file').setInputFiles({
    name: 'study.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('2 ready, 0 with errors.')).toBeVisible();

  let importCalls = 0;
  await page.route('**/api/links/import', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    importCalls += 1;
    if (importCalls === 1) {
      const body = route.request().postDataJSON() as { rows: { row: number }[] };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: body.rows.map((row, index) => (
            index === 0
              ? { row: row.row, status: 'created', linkId: '00000000-0000-4000-8000-000000000001' }
              : { row: row.row, status: 'error', error: 'Could not create link.' }
          )),
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Import valid rows' }).click();
  const table = page.locator('table');
  await expect(table.getByText('Created')).toHaveCount(1);
  await expect(table.getByText('Could not create link.')).toBeVisible();
  await expect(page.getByText('1 rows failed. Retry only those rows.')).toBeVisible();

  await page.getByRole('button', { name: 'Retry failed rows' }).click();
  await expect(table.getByText('Could not create link.')).toHaveCount(0);
  await expect(table.getByText('Created')).toHaveCount(2);
  await expect(page.getByText(/rows failed/)).toHaveCount(0);
});
