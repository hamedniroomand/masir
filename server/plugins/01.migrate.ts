import { runMigrations } from '#server/database/migrate';

export default defineNitroPlugin(async () => {
  const { databaseUrl, migrateOnBoot } = useRuntimeConfig();
  if (!migrateOnBoot)
    return;
  await runMigrations(databaseUrl);
});
