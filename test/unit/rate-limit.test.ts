import { beforeEach, describe, expect, it } from 'vitest';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { createMemoryStore, setRateLimitStore } from '#server/utils/rate-limit-store';

beforeEach(() => {
  setRateLimitStore(createMemoryStore());
});

describe('rateLimitCheck', () => {
  // The store counts the current request, so the comparison is > and not >=.
  // An off-by-one here changes the budget without failing any e2e test.
  it('allows exactly the limit, then refuses', async () => {
    for (let i = 0; i < 10; i++)
      expect((await rateLimitCheck('a', 10, 60_000)).ok).toBe(true);

    const refused = await rateLimitCheck('a', 10, 60_000);
    expect(refused.ok).toBe(false);
  });

  it('reports a retry delay of at least one second', async () => {
    await rateLimitCheck('b', 1, 60_000);
    const refused = await rateLimitCheck('b', 1, 60_000);
    expect(refused.ok).toBe(false);
    if (!refused.ok)
      expect(refused.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('counts each key on its own budget', async () => {
    await rateLimitCheck('c', 1, 60_000);
    expect((await rateLimitCheck('d', 1, 60_000)).ok).toBe(true);
  });
});
