import process from 'node:process';
import { openDatabase } from '#server/database/client';
import { runMigrations } from '#server/database/migrate';
import { authIdentities, securityEvents, users, workspaceMembers, workspaces } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { newId } from '#shared/id';
import { normalizeWorkspaceSlug } from '#shared/workspace-slug';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'postgres://linkyard:linkyard@127.0.0.1:5432/linkyard';
const workspaceName = process.env.WORKSPACE_NAME ?? 'My workspace';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

await runMigrations(databaseUrl);
const db = openDatabase(databaseUrl);
const existing = await db.select().from(users).limit(1);
if (existing.length > 0) {
  console.error('Users already exist; seed refused.');
  process.exit(1);
}

const id = newId();
const normalizedEmail = email.toLowerCase();
const now = new Date();
await db.insert(users).values({
  id,
  email: normalizedEmail,
  emailVerifiedAt: now,
  firstName: 'Admin',
  lastName: null,
  avatarUrl: null,
  createdAt: now,
  updatedAt: now,
  lastLoginAt: null,
});

await db.insert(authIdentities).values({
  id: newId(),
  userId: id,
  provider: 'PASSWORD',
  providerAccountId: id,
  passwordHash: await hashSecret(password),
  createdAt: now,
  updatedAt: now,
});

await db.insert(securityEvents).values({
  id: newId(),
  createdAt: new Date(),
  type: 'admin_seeded',
  actorUserId: id,
  detail: JSON.stringify({ email: normalizedEmail }),
});

// A user without a workspace can sign in and reach nothing, so the first
// workspace and its owner membership are seeded together.
const workspaceId = newId();
const workspaceSlug = normalizeWorkspaceSlug(workspaceName) || 'workspace';
await db.insert(workspaces).values({
  id: workspaceId,
  name: workspaceName,
  slug: workspaceSlug,
  plan: 'TRIAL',
  createdAt: now,
  updatedAt: now,
});

await db.insert(workspaceMembers).values({
  id: newId(),
  workspaceId,
  userId: id,
  role: 'OWNER',
  createdAt: now,
  updatedAt: now,
});

console.log('Admin created:', normalizedEmail);
console.log('Workspace created:', `${workspaceName} (${workspaceSlug})`);
await db.$client.end();
