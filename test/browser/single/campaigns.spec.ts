import { expect, test } from '../fixtures';
import { chooseOption } from '../ui';

let workspaceId = '';
let linkId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  linkId = db.insertLink({ workspaceId, slug: 'spring', title: 'Spring link', destinationUrl: 'https://example.com/spring' });
});

test('creates a campaign through the form and renders it in the list and the detail', async ({ page, login }) => {
  await login();
  await page.goto('/campaigns');
  await page.getByRole('button', { name: 'New campaign' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Campaign name').fill('Spring launch');
  await dialog.getByLabel('utm_campaign').fill('spring-launch');
  await dialog.getByLabel('utm_medium').fill('email');
  await dialog.getByRole('button', { name: 'Create campaign' }).click();

  await expect(page.getByText('utm_campaign=spring-launch')).toBeVisible();
  await page.getByRole('link', { name: /Spring launch/ }).click();
  await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible();
  await expect(page.getByText('Link performance')).toBeVisible();
});

test('creates a link from campaign detail with the campaign selected', async ({ page, login }) => {
  await login();
  await page.goto('/campaigns');
  await page.getByRole('link', { name: /Spring launch/ }).click();
  await page.getByRole('button', { name: 'Create link in this campaign' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Create a link' })).toBeVisible();
  await dialog.getByLabel('Destination URL').fill('https://example.com/campaign');
  await dialog.getByLabel('Title').fill('Spring campaign link');
  await dialog.getByRole('button', { name: 'Campaign and tracking' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Campaign' })).toContainText('Spring launch');
  await expect(dialog.getByRole('textbox', { name: 'Campaign', exact: true })).toHaveValue('spring-launch');

  const response = page.waitForResponse(response => response.url().endsWith('/api/links') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Create link', exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(dialog.getByText('Link created')).toBeVisible();
});

test('refuses a second campaign with the same utm_campaign', async ({ page, login }) => {
  await login();
  await page.goto('/campaigns');
  await page.getByRole('button', { name: 'New campaign' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Campaign name').fill('Spring again');
  await dialog.getByLabel('utm_campaign').fill('spring-launch');
  const answer = page.waitForResponse(response => response.url().endsWith('/api/campaigns') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Create campaign' }).click();
  expect((await answer).status()).toBe(409);
  await expect(dialog.getByText('Another campaign already uses this utm_campaign value.')).toBeVisible();
});

test('attaches a link to a campaign and shows the values it inherits', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${linkId}?tab=settings`);
  await chooseOption(page, 'Campaign', 'Spring launch');
  await page.getByRole('button', { name: 'Save tracking' }).click();
  await expect(page.getByText('Tracking saved')).toBeVisible();

  await page.reload();
  await expect(page.getByText(/utm_medium=email/)).toBeVisible();
  await expect(page.getByText(/utm_campaign=spring-launch/)).toBeVisible();
});

test('detaches a link and stops the values it inherited', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${linkId}?tab=settings`);
  await chooseOption(page, 'Campaign', 'No campaign');
  await page.getByRole('button', { name: 'Save tracking' }).click();
  await expect(page.getByText('Tracking saved')).toBeVisible();

  await page.reload();
  await expect(page.getByText(/utm_campaign=spring-launch/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Spring link' })).toBeVisible();
});

test('deletes a campaign and keeps the links it held', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${linkId}?tab=settings`);
  await chooseOption(page, 'Campaign', 'Spring launch');
  await page.getByRole('button', { name: 'Save tracking' }).click();
  await expect(page.getByText('Tracking saved')).toBeVisible();

  await page.goto('/campaigns');
  await page.getByRole('link', { name: /Spring launch/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete campaign' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByText('utm_campaign=spring-launch')).toHaveCount(0);

  await page.goto(`/links/${linkId}?tab=settings`);
  await expect(page.getByRole('heading', { name: 'Spring link' })).toBeVisible();
  await expect(page.getByText(/utm_campaign=spring-launch/)).toHaveCount(0);
});
