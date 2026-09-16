import process from 'node:process';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL ?? 'postgres://linkyard:linkyard@127.0.0.1:5432/linkyard',
  },
});
