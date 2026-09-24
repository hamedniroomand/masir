import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures';

let workspaceId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  db.insertCampaign({ workspaceId, utmCampaign: 'r2-study', name: 'R2 study' });
});

test('creates newsletter, social, and print links in one campaign launch', async ({ page, login }) => {
  await login();
  await page.goto('/campaigns');
  await page.getByRole('link', { name: /R2 study/ }).click();
  await page.getByRole('button', { name: 'Create links in this campaign' }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Destination').fill('https://example.com/r2-study');
  await expect(dialog.getByText('utm_source=newsletter&utm_medium=email&utm_campaign=r2-study')).toBeVisible();
  await expect(dialog.getByText('utm_source=twitter&utm_medium=social&utm_campaign=r2-study')).toBeVisible();
  await expect(dialog.getByText('utm_source=print&utm_medium=print&utm_campaign=r2-study')).toBeVisible();

  await dialog.getByRole('button', { name: 'Create links' }).click();
  await expect(dialog.getByText(/Created https?:/)).toHaveCount(3);
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
