import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { chooseOption } from '../ui';

test.beforeAll(({ db }) => {
  db.reset();
});

async function createLink(page: Page, body: Record<string, unknown>) {
  const response = await page.request.post('/api/links', { data: body });
  expect(response.status()).toBe(201);
  return await response.json() as { id: string };
}

test('changes the matched rule when the preview country changes', async ({ page, login }) => {
  await login();
  const link = await createLink(page, {
    destinationUrl: 'https://example.com/default',
    slug: 'preview-geo',
    title: 'Preview geo',
    targeting: {
      country: {
        US: 'https://example.com/us',
        DE: 'https://example.com/de',
      },
    },
  });

  await page.goto(`/links/${link.id}`);
  await page.getByRole('button', { name: 'Preview routing' }).click();
  const panel = page.getByLabel('Routing preview');
  await expect(panel.getByText('Matched rule')).toBeVisible();
  await expect(panel.getByText('Default destination')).toBeVisible();
  await expect(panel.getByText('https://example.com/default')).toBeVisible();

  await chooseOption(page, 'Country', 'US — United States');
  await expect(panel.getByText('Country rule')).toBeVisible();
  await expect(panel.getByText('https://example.com/us')).toBeVisible();

  await chooseOption(page, 'Country', 'DE — Germany');
  await expect(panel.getByText('Country rule')).toBeVisible();
  await expect(panel.getByText('https://example.com/de')).toBeVisible();
});
