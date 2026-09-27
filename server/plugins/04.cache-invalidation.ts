import { RedisClient } from 'bun';
import { applyRemoteInvalidation, closeLinkCacheClients, LINK_INVALIDATE_CHANNEL } from '#server/utils/link-cache';
import { setSignal } from '#server/utils/service-signals';

export default defineNitroPlugin(async (nitro) => {
  const config = useRuntimeConfig();
  if (!config.linkCacheSharedInvalidation || !config.redisUrl)
    return;

  let subscriber: RedisClient | null = null;
  try {
    subscriber = new RedisClient(config.redisUrl);
    subscriber.onconnect = async () => {
      await setSignal('link_cache', 'ok', { at: new Date().toISOString() });
    };
    subscriber.onclose = async (error) => {
      const errorMsg = error ? (error instanceof Error ? error.message : String(error)) : 'closed';
      await setSignal('link_cache', 'degraded', { error: errorMsg, at: new Date().toISOString() });
    };

    await subscriber.subscribe(LINK_INVALIDATE_CHANNEL, (rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage);
        applyRemoteInvalidation(parsed);
      }
      catch (error) {
        console.error('[link-cache] failed to parse invalidation message:', error);
      }
    });
    await setSignal('link_cache', 'ok', { at: new Date().toISOString() });
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await setSignal('link_cache', 'degraded', { error: errorMsg, at: new Date().toISOString() });
  }

  nitro.hooks.hook('close', () => {
    if (subscriber) {
      try {
        subscriber.close();
      }
      catch {}
      subscriber = null;
    }
    closeLinkCacheClients();
  });
});
