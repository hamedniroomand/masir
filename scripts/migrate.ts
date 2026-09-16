import process from 'node:process';
import { runMigrations } from '#server/database/migrate';

const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'postgres://linkyard:linkyard@127.0.0.1:5432/linkyard';
await runMigrations(databaseUrl);
