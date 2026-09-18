import { expect, test } from '../fixtures';
import { chooseOption } from '../ui';

// The client draws this panel, so what it shows belongs here. The HTTP suite
// already checks the numbers the API returns.
let workspaceId = '';
let busyLink = '';
let quietLink = '';

// Every batch shares one timestamp. Two different ones can straddle a UTC
// midnight, and the daily series would then split the clicks across two buckets.
test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
  busyLink = db.insertLink({ workspaceId, slug: 'busy', title: 'Busy link', clickCount: 5 });
  quietLink = db.insertLink({ workspaceId, slug: 'quiet', title: 'Quiet link' });

  db.insertClicks({ workspaceId, linkId: busyLink, count: 3, visitor: 11, referrer: 'news.example.com', country: 'US', device: 'desktop', browser: 'chrome', minutesAgo: 10 });
  db.insertClicks({ workspaceId, linkId: busyLink, count: 2, visitor: 22, referrer: 'social.example.com', country: 'DE', device: 'mobile', browser: 'safari', minutesAgo: 10 });
  db.insertClicks({ workspaceId, linkId: busyLink, count: 3, outcome: 'bot_request', minutesAgo: 10 });
});

test('counts total clicks, unique visitors, and bot requests', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${busyLink}`);
  await expect(page.getByText('Total clicks')).toBeVisible();
  await expect(page.getByText('Total clicks').locator('xpath=following-sibling::p[1]')).toHaveText('5');
  await expect(page.getByText('Unique visitors').locator('xpath=following-sibling::p[1]')).toHaveText('2');
  await expect(page.getByText('Bot requests').locator('xpath=following-sibling::p[1]')).toHaveText('3');
});

test('tells the owner when the period holds no clicks', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${quietLink}`);
  await expect(page.getByRole('heading', { name: 'No clicks in this period' })).toBeVisible();
});

test('redraws the chart in hourly buckets for the last 24 hours', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${busyLink}`);
  await expect(page.getByRole('img', { name: /peak 5/ })).toBeVisible();

  await chooseOption(page, 'Analytics period', 'Last 24 hours');
  await page.getByRole('button', { name: 'View as table' }).click();
  await expect(page.getByRole('cell', { name: /T\d\d:00:00\.000Z/ }).first()).toBeVisible();
});

test('filters the series to the chosen traffic class', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${busyLink}`);
  await chooseOption(page, 'Chart traffic', 'Bot traffic');
  await expect(page.getByRole('img', { name: /peak 3/ })).toBeVisible();

  await chooseOption(page, 'Chart traffic', 'All traffic');
  await expect(page.getByRole('img', { name: /peak 8/ })).toBeVisible();
});

test('breaks the clicks down by referrer, country, device, and browser', async ({ page, login }) => {
  await login();
  await page.goto(`/links/${busyLink}`);
  for (const [title, top, second] of [
    ['Referrers', 'news.example.com', 'social.example.com'],
    ['Countries', 'US', 'DE'],
    ['Devices', 'desktop', 'mobile'],
    ['Browsers', 'chrome', 'safari'],
  ]) {
    const list = page.getByRole('heading', { name: title! }).locator('xpath=ancestor::section[1]');
    await expect(list.getByText(top!)).toBeVisible();
    await expect(list.getByText(second!)).toBeVisible();
  }
});
