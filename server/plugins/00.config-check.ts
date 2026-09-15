import { assertRuntimeConfig } from '#server/utils/config-assert';

export default defineNitroPlugin(() => {
  assertRuntimeConfig(useRuntimeConfig());
});
