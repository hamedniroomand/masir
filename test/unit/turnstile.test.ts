import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '#server/utils/turnstile';

function cloudflareAnswer(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body)));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifyTurnstile', () => {
  it('passes without a call when no secret is set', async () => {
    const fetchMock = cloudflareAnswer({ success: false });
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyTurnstile('any', '', '203.0.113.9')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a missing token without a call', async () => {
    const fetchMock = cloudflareAnswer({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyTurnstile(undefined, 'secret', '203.0.113.9')).toBe(false);
    expect(await verifyTurnstile('', 'secret', '203.0.113.9')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the secret, the token, and the client address', async () => {
    const fetchMock = cloudflareAnswer({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyTurnstile('tok', 'secret', '203.0.113.9')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(JSON.parse(String(init.body))).toEqual({ secret: 'secret', response: 'tok', remoteip: '203.0.113.9' });
  });

  it('refuses when Cloudflare says no', async () => {
    vi.stubGlobal('fetch', cloudflareAnswer({ success: false, 'error-codes': ['invalid-input-response'] }));
    expect(await verifyTurnstile('tok', 'secret', '203.0.113.9')).toBe(false);
  });

  it('refuses when Cloudflare cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    expect(await verifyTurnstile('tok', 'secret', '203.0.113.9')).toBe(false);
  });
});
