import { runMigrations } from '#server/database/migrate';

export default defineNitroPlugin(async () => {
  const { databaseUrl } = useRuntimeConfig();
  await runMigrations(databaseUrl);
});
