import { expect, test } from '../fixtures';

test.beforeAll(({ db }) => {
  db.reset();
});

// Node resolves nothing under masir.test, so the request goes to loopback and
// names the workspace host in the Host header, which is what the middleware
// compares the Origin against.
test('refuses a state-changing post from another origin', async ({ page, login, server }) => {
  await login();
  const port = new URL(server.baseURL).port;
  const host = new URL(server.hostUrl('acme')).host;
  const cookies = await page.context().cookies();
  const cookie = cookies.map(entry => `${entry.name}=${entry.value}`).join('; ');

  const refused = await page.request.post(`http://127.0.0.1:${port}/api/links`, {
    headers: { host, cookie, origin: 'https://attacker.example.com' },
    data: { destinationUrl: 'https://example.com/csrf' },
  });
  expect(refused.status()).toBe(403);

  const allowed = await page.request.post(`http://127.0.0.1:${port}/api/links`, {
    headers: { host, cookie, origin: `http://${host}` },
    data: { destinationUrl: 'https://example.com/same-origin' },
  });
  expect(allowed.status()).toBe(201);
});
