import process from 'node:process';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL ?? 'file:./data/linkyard.db',
  },
});
