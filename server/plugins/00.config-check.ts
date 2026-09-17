import { assertRuntimeConfig } from '#server/utils/config-assert';
import { assertStorageConfig } from '#server/utils/storage';

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  // Nuxt widens runtimeConfig string literals to `string`. The cast is safe:
  // assertRuntimeConfig validates the value at runtime and throws on a bad one.
  assertRuntimeConfig(config as Parameters<typeof assertRuntimeConfig>[0]);
  assertStorageConfig(config.storage, config.deploymentMode as Parameters<typeof assertStorageConfig>[1]);
});
