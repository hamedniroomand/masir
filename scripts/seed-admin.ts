import process from 'node:process';
import { hashPassword } from '#scripts/hash-password';
import { openDatabase } from '#server/database/client';
import { runMigrations } from '#server/database/migrate';
import { securityEvents, users } from '#server/database/schema';
import { newId } from '#shared/id';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'file:./data/linkyard.db';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

await runMigrations(databaseUrl);
const db = await openDatabase(databaseUrl);
const existing = await db.select().from(users).limit(1);
if (existing.length > 0) {
  console.error('Users already exist; seed refused.');
  process.exit(1);
}

const id = newId();
const normalizedEmail = email.toLowerCase();
await db.insert(users).values({
  id,
  email: normalizedEmail,
  passwordHash: await hashPassword(password),
  name: 'Admin',
  role: 'admin',
  isActive: true,
  createdAt: new Date(),
});

await db.insert(securityEvents).values({
  id: newId(),
  createdAt: new Date(),
  type: 'admin_seeded',
  actorUserId: id,
  detail: JSON.stringify({ email: normalizedEmail }),
});

console.log('Admin created:', normalizedEmail);
