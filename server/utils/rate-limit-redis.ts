import type { RateLimitStore } from '#server/utils/rate-limit-store';
import { RedisClient } from 'bun';

// Two round trips for each limited request. EXPIRE ... NX only sets a window on
// a key that has none, so it is safe to send every time: setting it only when
// the count is 1 would leave a key without a TTL, and a caller locked out for
// good, if the process died in between.
export function createRedisStore(url: string): RateLimitStore {
  const client = new RedisClient(url);

  return {
    async hit(key, windowMs) {
      const namespaced = `linkyard:rl:${key}`;
      const count = await client.incr(namespaced);
      await client.send('EXPIRE', [namespaced, String(Math.ceil(windowMs / 1000)), 'NX']);
      // A full window, so Retry-After can only overstate the wait.
      return { count, resetAt: Date.now() + windowMs };
    },
  };
}
