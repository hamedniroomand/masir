import { runMigrations } from '#server/database/migrate';

export default defineNitroPlugin(async () => {
  const { databaseUrl, migrateOnBoot } = useRuntimeConfig();
  // A serverless instance boots on every cold start. Turn this off there and
  // run `bun run db:migrate` as a deploy step instead.
  if (!migrateOnBoot)
    return;
  await runMigrations(databaseUrl);
});
