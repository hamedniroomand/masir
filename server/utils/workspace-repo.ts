import type { Workspace } from '#server/database/schema';
import type { WorkspaceRole } from '#shared/permissions';
import { and, count, eq, isNull } from 'drizzle-orm';
import { users, workspaceMembers, workspaces } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

export async function findWorkspaceBySlug(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt))).limit(1);
  return rows[0] ?? null;
}

// Self-hosted holds one workspace. The host carries no subdomain there.
export async function findSingleWorkspace() {
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(isNull(workspaces.deletedAt)).limit(1);
  return rows[0] ?? null;
}

export async function findMembership(workspaceId: string, userId: string) {
  const db = await getDb();
  const rows = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, userId),
    isNull(workspaceMembers.deactivatedAt),
  )).limit(1);
  return rows[0] ?? null;
}

// One query for the two things every workspace request must check: the session
// is still current, and the caller still belongs here. Two separate reads would
// double the round trips on every authenticated request.
export async function findMemberAccess(workspaceId: string, userId: string) {
  const db = await getDb();
  const rows = await db.select({
    role: workspaceMembers.role,
    sessionVersion: users.sessionVersion,
  })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
      isNull(workspaceMembers.deactivatedAt),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function listMembershipsForUser(userId: string) {
  const db = await getDb();
  return db.select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(
      eq(workspaceMembers.userId, userId),
      isNull(workspaceMembers.deactivatedAt),
      isNull(workspaces.deletedAt),
    ));
}

export async function countWorkspaces() {
  const db = await getDb();
  const rows = await db.select({ n: count() }).from(workspaces).where(isNull(workspaces.deletedAt));
  return Number(rows[0]?.n ?? 0);
}

export async function isWorkspaceSlugTaken(slug: string) {
  return (await findWorkspaceBySlug(slug)) != null;
}

export async function createWorkspaceWithOwner(input: {
  name: string;
  slug: string;
  logoUrl: string | null;
  ownerUserId: string;
  trialDays: number | null;
}): Promise<Workspace> {
  const db = await getDb();
  const now = new Date();
  const id = newId();
  const trialEndsAt = input.trialDays == null
    ? null
    : new Date(now.getTime() + input.trialDays * 86_400_000);

  // One transaction. A workspace must never exist without its owner.
  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      id,
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl,
      plan: 'TRIAL',
      trialStartedAt: input.trialDays == null ? null : now,
      trialEndsAt,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({
      id: newId(),
      workspaceId: id,
      userId: input.ownerUserId,
      role: 'OWNER' satisfies WorkspaceRole,
      createdAt: now,
      updatedAt: now,
    });
  });

  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return rows[0]!;
}
