import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

test('holds the sign-in button until Turnstile issues a token, then signs in', async ({ page, login }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with email instead' }).click();
  // The widget draws inside a closed shadow root, so only its hidden response
  // field is visible to the test.
  const token = page.getByTestId('turnstile').locator('input[name="cf-turnstile-response"]');
  await expect(token).toHaveValue(/.+/);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();

  await login();
  await expect(page).toHaveURL(/\/workspaces$|\/$/);
});

// Node resolves nothing under masir.test, so the call goes to localhost and
// names the host in the header.
test('refuses a submit without a token', async ({ request, server }) => {
  const origin = new URL(server.baseURL);
  const response = await request.post(`http://localhost:${origin.port}/api/auth/login`, {
    headers: { host: origin.host },
    data: { email: 'someone@example.com', password: 'whatever-12345!' },
  });
  expect(response.status()).toBe(422);
  const body = await response.json() as { data?: { reason?: string } };
  expect(body.data?.reason).toBe('Complete the robot check.');
});
