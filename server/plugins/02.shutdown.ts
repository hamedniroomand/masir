import { closeDatabase } from '../database/client';

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', () => {
    closeDatabase();
  });
});
