import { expect, test } from '../fixtures';
import { chooseOption, DAY_MS } from '../ui';

let workspaceId = '';

test.beforeAll(({ db }) => {
  ({ workspaceId } = db.reset());
});

const rows = (page: import('@playwright/test').Page) => page.getByRole('article');
const badge = (page: import('@playwright/test').Page) => page.getByRole('heading', { name: /All links/ });

// The library starts empty, so this runs before anything seeds a link.
test('offers the first-link empty state on an empty workspace', async ({ page, login }) => {
  await login();
  await expect(page.getByRole('heading', { name: 'Create your first short link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create your first link' })).toBeVisible();
});

test.describe('with a seeded library', () => {
  test.beforeAll(({ db }) => {
    db.insertLink({ workspaceId, slug: 'alpha', title: 'Alpha launch', clickCount: 12, tags: ['docs'] });
    db.insertLink({ workspaceId, slug: 'beta', title: 'Beta guide', clickCount: 3, tags: ['ads'] });
    db.insertLink({ workspaceId, slug: 'gamma-off', title: 'Gamma paused', isEnabled: false });
    db.insertLink({ workspaceId, slug: 'delta-old', title: 'Delta gone', expiresAt: new Date(Date.now() - DAY_MS).toISOString() });
    db.insertLink({ workspaceId, slug: 'epsilon-soon', title: 'Epsilon later', startsAt: new Date(Date.now() + DAY_MS).toISOString() });
  });

  test('counts every link in the heading badge and lists one row for each', async ({ page, login }) => {
    await login();
    await expect(badge(page)).toHaveText('All links5');
    await expect(rows(page)).toHaveCount(5);
  });

  test('narrows the list to the searched title', async ({ page, login }) => {
    await login();
    await page.getByLabel('Search links').fill('Alpha');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Alpha launch', exact: true })).toBeVisible();
  });

  test('offers the no-match empty state when nothing answers the search', async ({ page, login }) => {
    await login();
    await page.getByLabel('Search links').fill('nothing-matches-this');
    await expect(page.getByRole('heading', { name: 'No matching links' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });

  test('shows only the links in the chosen status', async ({ page, login }) => {
    await login();
    await chooseOption(page, 'Filter links by status', 'Disabled');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Gamma paused', exact: true })).toBeVisible();

    await chooseOption(page, 'Filter links by status', 'Scheduled');
    await expect(page.getByRole('link', { name: 'Epsilon later', exact: true })).toBeVisible();
  });

  test('filters on a tag chip and marks the chip as pressed', async ({ page, login }) => {
    await login();
    const chip = page.getByRole('button', { name: 'docs', exact: true });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Alpha launch', exact: true })).toBeVisible();
  });

  test('reorders the list when the sort control changes', async ({ page, login }) => {
    await login();
    // The seed inserts in order, so newest first puts the last one on top.
    await expect(rows(page).first()).toContainText('Epsilon later');
    await chooseOption(page, 'Sort links', 'Most clicked');
    await expect(rows(page).first()).toContainText('Alpha launch');
  });

  test('clears the search, the status, and the tags with one button', async ({ page, login }) => {
    await login();
    await page.getByLabel('Search links').fill('Alpha');
    await chooseOption(page, 'Filter links by status', 'Active');
    await page.getByRole('button', { name: 'docs', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(page.getByLabel('Search links')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'docs', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(rows(page)).toHaveCount(5);
  });

  // No page renames or deletes a tag today, so the change comes through the API
  // and the check is what the filter bar renders after it.
  test('keeps a link when its tag is renamed and drops the chip when the tag goes', async ({ page, login }) => {
    await login();
    const list = await (await page.request.get('/api/tags')).json() as { items: { id: string; name: string }[] };
    const docs = list.items.find(tag => tag.name === 'docs')!;

    await page.request.patch(`/api/tags/${docs.id}`, { data: { name: 'handbook' } });
    await page.reload();
    await expect(page.getByRole('button', { name: 'handbook', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'handbook', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Alpha launch', exact: true })).toBeVisible();

    await page.request.delete(`/api/tags/${docs.id}`);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'handbook', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Alpha launch', exact: true })).toBeVisible();
  });

  test('treats a tag name as the same tag whatever its case and spacing', async ({ page, login }) => {
    await login();
    await page.request.post('/api/tags', { data: { name: '  Ads  ' } });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'ads', exact: true })).toHaveCount(1);
  });
});

test.describe('with more links than one page', () => {
  test.beforeAll(({ db }) => {
    db.insertLinks({ workspaceId, slugs: Array.from({ length: 20 }, (_, index) => `page-${String(index).padStart(2, '0')}`) });
  });

  test('moves between pages of links', async ({ page, login }) => {
    await login();
    await expect(page.getByText('Showing 1–20 of 25 links')).toBeVisible();
    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(page.getByText('Showing 21–25 of 25 links')).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
  });
});
