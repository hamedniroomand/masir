import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('opens a seeded demo workspace with a banner and a link cap', async ({ page, server }) => {
  // Only Chromium resolves masir.test, so the call goes from the page. It also
  // puts the session cookie on the browser context, as the button does.
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
  const slug = new URL(url).hostname.split('.')[0]!;
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
