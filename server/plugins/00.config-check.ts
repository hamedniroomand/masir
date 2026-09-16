import { assertRuntimeConfig } from '#server/utils/config-assert';

export default defineNitroPlugin(() => {
  // Nuxt widens runtimeConfig string literals to `string`. The cast is safe:
  // assertRuntimeConfig validates the value at runtime and throws on a bad one.
  assertRuntimeConfig(useRuntimeConfig() as Parameters<typeof assertRuntimeConfig>[0]);
});
