import type { WorkspaceRole } from '#shared/permissions';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { users, workspaceMembers, workspaces } from '#server/database/schema';
import { getDb, isUuid } from '#server/utils/db';
import { getRetainedPrefixesCached } from '#server/utils/link-prefix-repo';
import { roleLabel, roleName } from '#shared/permissions';

export async function findWorkspaceById(id: string) {
  if (!isUuid(id))
    return null;
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  const workspace = rows[0];
  if (!workspace)
    return null;
  const retainedPrefixes = await getRetainedPrefixesCached(workspace.id);
  return { ...workspace, retainedPrefixes };
}

// The install holds one workspace. The oldest one wins.
// ponytail: one indexed LIMIT 1 for every request.
// Measured at 0.04ms of query above a 0.2ms round trip, so a cache would buy
// ~0.24ms and cost a window where a renamed or deleted workspace still
// resolves, invisibly across instances. Revisit only if a profile says so.
export async function findSingleWorkspace() {
  const db = await getDb();
  const rows = await db.select().from(workspaces).orderBy(asc(workspaces.createdAt)).limit(1);
  const workspace = rows[0];
  if (!workspace)
    return null;
  const retainedPrefixes = await getRetainedPrefixesCached(workspace.id);
  return { ...workspace, retainedPrefixes };
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
    ));
  return rows.map(row => ({ ...row, role: roleName(row.role) }));
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

// Ownership moves only through transfer, so this never writes owner.
export async function setMemberRole(workspaceId: string, userId: string, role: Exclude<WorkspaceRole, 'OWNER'>) {
  const db = await getDb();
  await db.update(workspaceMembers)
    .set({ role: roleLabel(role), updatedAt: new Date() })
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

export async function updateWorkspace(workspaceId: string, patch: { name?: string; linkPrefix?: string | null; logoUrl?: string | null }) {
  const db = await getDb();
  await db.update(workspaces).set({ ...patch, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId));
  return findWorkspaceById(workspaceId);
}
