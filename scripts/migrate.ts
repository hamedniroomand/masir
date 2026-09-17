import process from 'node:process';
import { runMigrations } from '#server/database/migrate';

const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'postgres://masir:masir@127.0.0.1:5432/masir';
await runMigrations(databaseUrl);
