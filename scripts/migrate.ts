import process from 'node:process';
import { runMigrations } from '../server/database/migrate';

const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'file:./data/linkyard.db';
await runMigrations(databaseUrl);
