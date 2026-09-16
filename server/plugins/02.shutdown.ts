import { closeDatabase } from '#server/database/client';

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    await closeDatabase();
  });
});
