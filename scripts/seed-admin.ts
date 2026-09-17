import process from 'node:process';
import { openDatabase } from '#server/database/client';
import { runMigrations } from '#server/database/migrate';
import { auditEvents, authIdentities, users, workspaceMembers, workspaces } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { normalizeWorkspaceSlug } from '#shared/workspace-slug';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'postgres://masir:masir@127.0.0.1:5432/masir';
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

const normalizedEmail = email.toLowerCase();
const [user] = await db.insert(users).values({
  email: normalizedEmail,
  emailVerifiedAt: new Date(),
  firstName: 'Admin',
}).returning();
if (!user)
  throw new Error('insert failed');

await db.insert(authIdentities).values({
  userId: user.id,
  provider: 'password',
  providerAccountId: user.id,
  passwordHash: await hashSecret(password),
});

await db.insert(auditEvents).values({
  type: 'admin_seeded',
  actorId: user.id,
  detail: { email: normalizedEmail },
});

// A user without a workspace can sign in and reach nothing, so the first
// workspace and its owner membership are seeded together.
const workspaceSlug = normalizeWorkspaceSlug(workspaceName) || 'workspace';
const [workspace] = await db.insert(workspaces).values({
  name: workspaceName,
  slug: workspaceSlug,
}).returning();
if (!workspace)
  throw new Error('insert failed');

await db.insert(workspaceMembers).values({
  workspaceId: workspace.id,
  userId: user.id,
  role: 'owner',
});

console.log('Admin created:', normalizedEmail);
console.log('Workspace created:', `${workspaceName} (${workspaceSlug})`);
await db.$client.end();
