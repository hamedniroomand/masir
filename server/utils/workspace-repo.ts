import type { Workspace } from '#server/database/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { users, workspaceMembers, workspaces } from '#server/database/schema';
import { getDb, isUuid } from '#server/utils/db';
import { roleName } from '#shared/permissions';

export async function findWorkspaceBySlug(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt))).limit(1);
  return rows[0] ?? null;
}

export async function findWorkspaceById(id: string) {
  if (!isUuid(id))
    return null;
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt))).limit(1);
  return rows[0] ?? null;
}

// Self-hosted holds one workspace. The host carries no subdomain there.
// ponytail: one indexed LIMIT 1 for every request in single-workspace mode.
// Measured at 0.04ms of query above a 0.2ms round trip, so a cache would buy
// ~0.24ms and cost a window where a renamed or deleted workspace still
// resolves, invisibly across instances. Revisit only if a profile says so.
export async function findSingleWorkspace() {
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(isNull(workspaces.deletedAt)).limit(1);
  return rows[0] ?? null;
}

export async function findMembership(workspaceId: string, userId: string) {
  if (!isUuid(workspaceId) || !isUuid(userId))
    return null;
  const db = await getDb();
  const rows = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, userId),
    isNull(workspaceMembers.deactivatedAt),
  )).limit(1);
  const row = rows[0];
  return row ? { ...row, role: roleName(row.role) } : null;
}

// One query for the two things every workspace request must check: the session
// is still current, and the caller still belongs here. Two separate reads would
// double the round trips on every authenticated request.
export async function findMemberAccess(workspaceId: string, userId: string) {
  if (!isUuid(workspaceId) || !isUuid(userId))
    return null;
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
  const row = rows[0];
  return row ? { ...row, role: roleName(row.role) } : null;
}

export async function listMembershipsForUser(userId: string) {
  const db = await getDb();
  const rows = await db.select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(
      eq(workspaceMembers.userId, userId),
      isNull(workspaceMembers.deactivatedAt),
      isNull(workspaces.deletedAt),
    ));
  return rows.map(row => ({ ...row, role: roleName(row.role) }));
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
}): Promise<Workspace> {
  const db = await getDb();

  // One transaction. A workspace must never exist without its owner.
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(workspaces).values({
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl,
    }).returning();
    if (!created)
      throw new Error('The workspace vanished between its insert and its read.');

    await tx.insert(workspaceMembers).values({
      workspaceId: created.id,
      userId: input.ownerUserId,
      role: 'owner',
    });
    return created;
  });
}

export async function listMembers(workspaceId: string) {
  const db = await getDb();
  const rows = await db.select({
    userId: workspaceMembers.userId,
    role: workspaceMembers.role,
    deactivatedAt: workspaceMembers.deactivatedAt,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
    createdAt: workspaceMembers.createdAt,
  })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return rows.map(row => ({ ...row, role: roleName(row.role) }));
}

export async function findMember(workspaceId: string, userId: string) {
  if (!isUuid(workspaceId) || !isUuid(userId))
    return null;
  const db = await getDb();
  const rows = await db.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, userId),
  )).limit(1);
  const row = rows[0];
  return row ? { ...row, role: roleName(row.role) } : null;
}

export async function setMemberDeactivated(workspaceId: string, userId: string, deactivated: boolean) {
  const db = await getDb();
  // The flag lives on the membership. The same person may work in another
  // workspace, and that one must not change.
  await db.update(workspaceMembers)
    .set({ deactivatedAt: deactivated ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

export async function removeMember(workspaceId: string, userId: string) {
  const db = await getDb();
  const changed = await db.delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .returning({ userId: workspaceMembers.userId });
  return changed.length > 0;
}

// The old owner drops to member first. The partial unique index refuses two
// owners, so raising the new one before lowering the old one would fail.
export async function transferOwnership(workspaceId: string, fromUserId: string, toUserId: string) {
  const db = await getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(workspaceMembers)
      .set({ role: 'member', updatedAt: now })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, fromUserId)));
    await tx.update(workspaceMembers)
      .set({ role: 'owner', deactivatedAt: null, updatedAt: now })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, toUserId)));
  });
}

export async function updateWorkspace(workspaceId: string, patch: { name?: string; logoUrl?: string | null }) {
  const db = await getDb();
  await db.update(workspaces).set({ ...patch, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId));
  return findWorkspaceById(workspaceId);
}

export async function softDeleteWorkspace(workspaceId: string) {
  const db = await getDb();
  await db.update(workspaces)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}
