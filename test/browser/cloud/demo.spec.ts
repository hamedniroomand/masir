import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

// Only Chromium resolves masir.test, so the call goes from the page. It also
// puts the session cookie on the browser context, as the button does.
async function openDemo(page: Page) {
  await page.goto('/login');
  const url = await page.evaluate(async () => {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ turnstileToken: 'test' }),
    });
    if (res.status !== 201)
      throw new Error(`The demo route answered ${res.status}.`);
    return (await res.json() as { url: string }).url;
  });
  return new URL(url).hostname.split('.')[0]!;
}

test('opens a seeded demo workspace with a banner and a link cap', async ({ page, server }) => {
  const slug = await openDemo(page);
  expect(slug).toMatch(/^demo-[a-z0-9]{8}$/);

  // The sidebar also says "Demo workspace", so the banner is found by its
  // own words.
  await page.goto(`${server.hostUrl(slug)}/`);
  await expect(page.getByText(/deleted in 2[34] hours/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Install Masir' })).toBeVisible();
  await expect(page.getByText('Install guide')).toBeVisible();
  await expect(page.getByText('Feature tour')).toBeVisible();
  await expect(page.getByText('Analytics docs')).toBeVisible();
  await expect(page.getByText('Source on GitHub')).toBeVisible();

  await page.goto(`${server.hostUrl(slug)}/dashboard`);
  await expect(page.getByText(/deleted in 2[34] hours/)).toBeVisible();
});

// The visitor leaves the demo open, comes back a day later, and reloads. The
// sweep runs on an interval, so the reload meets one of two states.
test('keeps the expired demo readable until the sweep, then answers 404', async ({ page, db, server }) => {
  const slug = await openDemo(page);
  db.expireWorkspace(slug);

  // Past its expiry, before the sweep. Nothing reads expiresAt on the request
  // path, so the workspace still answers and only the banner shows the state.
  await page.goto(`${server.hostUrl(slug)}/`);
  await expect(page.getByText('It is deleted in 0 hours.')).toBeVisible();
  await expect(page.getByText('Install guide')).toBeVisible();

  expect(db.sweepDemos()).toBe(1);

  // The workspace and its owner are gone. The subdomain answers 404 for every
  // path, so the error page points at the root host.
  const response = await page.reload();
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Workspace not found.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Masir' })).toHaveAttribute('href', server.baseURL);
});
