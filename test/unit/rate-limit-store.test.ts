import type { RateLimitStore } from '#server/utils/rate-limit-store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { createMemoryStore, setRateLimitStore } from '#server/utils/rate-limit-store';

// Every driver must pass this. A shared store reuses it unchanged.
function storeContract(name: string, make: () => RateLimitStore) {
  describe(name, () => {
    it('counts up inside one window', async () => {
      const store = make();
      expect((await store.hit('a', 1000)).count).toBe(1);
      expect((await store.hit('a', 1000)).count).toBe(2);
      expect((await store.hit('a', 1000)).count).toBe(3);
    });

    it('keeps keys apart', async () => {
      const store = make();
      await store.hit('a', 1000);
      expect((await store.hit('b', 1000)).count).toBe(1);
    });

    it('reports when the window resets', async () => {
      const store = make();
      const before = Date.now();
      const { resetAt } = await store.hit('a', 1000);
      expect(resetAt).toBeGreaterThanOrEqual(before + 1000);
    });

    it('starts again after the window passes', async () => {
      const store = make();
      await store.hit('a', 1);
      await new Promise(done => setTimeout(done, 5));
      expect((await store.hit('a', 1)).count).toBe(1);
    });
  });
}

storeContract('memory store', () => createMemoryStore());

describe('store outage policy', () => {
  const broken: RateLimitStore = {
    hit: () => Promise.reject(new Error('redis unreachable')),
  };

  afterEach(() => {
    setRateLimitStore(null);
    vi.restoreAllMocks();
  });

  // An outage must not quietly turn brute-force protection off.
  it('denies by default when the store is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setRateLimitStore(broken);
    expect(await rateLimitCheck('login:x', 10, 60_000)).toMatchObject({ ok: false });
  });

  // A shortener that stops redirecting because Redis blinked is worse.
  it('allows the redirect path when the store is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setRateLimitStore(broken);
    expect(await rateLimitCheck('redirect:x', 120, 60_000, 'allow')).toEqual({ ok: true });
  });
});
