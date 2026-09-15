import process from 'node:process';
import { nanoid } from 'nanoid';
import { openDatabase } from '../server/database/client';
import { runMigrations } from '../server/database/migrate';
import { securityEvents, users } from '../server/database/schema';
import { hashPassword } from '../server/utils/password';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'file:./data/linkyard.db';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

await runMigrations(databaseUrl);
const db = await openDatabase(databaseUrl);
const existing = await db.select({ id: users.id }).from(users).limit(1);
if (existing.length > 0) {
  console.error('Users already exist; seed refused.');
  process.exit(1);
}

const id = nanoid();
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
  id: nanoid(),
  createdAt: new Date(),
  type: 'admin_seeded',
  actorUserId: id,
  detail: JSON.stringify({ email: normalizedEmail }),
});

console.log('Admin created:', normalizedEmail);
