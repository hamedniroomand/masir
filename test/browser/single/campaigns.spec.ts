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

test('creates email, social, and print links in one batch and previews each row', async ({ page, login }) => {
  await login();
  await page.goto('/campaigns');
  await page.getByRole('link', { name: /Spring launch/ }).click();
  await page.getByRole('button', { name: 'Create links in this campaign' }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Destination').fill('https://example.com/batch');
  await expect(dialog.getByText('utm_source=newsletter&utm_medium=email&utm_campaign=spring-launch')).toBeVisible();
  await expect(dialog.getByText('utm_source=twitter&utm_medium=social&utm_campaign=spring-launch')).toBeVisible();
  await expect(dialog.getByText('utm_source=print&utm_medium=print&utm_campaign=spring-launch')).toBeVisible();

  await dialog.getByRole('button', { name: 'Create links' }).click();
  await expect(dialog.getByText(/Created https:/)).toHaveCount(3);
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
