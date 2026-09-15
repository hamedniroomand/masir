import { assertRuntimeConfig } from '../utils/config-assert';

export default defineNitroPlugin(() => {
  assertRuntimeConfig(useRuntimeConfig());
});
