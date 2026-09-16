import type { RateLimitStore } from '#server/utils/rate-limit-store';
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '#server/utils/rate-limit-store';

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
