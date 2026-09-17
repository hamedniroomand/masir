import { and, eq, isNull } from 'drizzle-orm';
import { users, workspaceInvitations, workspaceMembers } from '#server/database/schema';
import { hashAuthToken, newAuthToken } from '#server/utils/auth-token';
import { getDb } from '#server/utils/db';
import { normalizeEmail } from '#server/utils/identity-repo';
import { newId } from '#shared/id';

export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function listPendingInvitations(workspaceId: string) {
  const db = await getDb();
  return db.select().from(workspaceInvitations).where(and(
    eq(workspaceInvitations.workspaceId, workspaceId),
    isNull(workspaceInvitations.acceptedAt),
    isNull(workspaceInvitations.revokedAt),
  ));
}

export async function findInvitationById(id: string, workspaceId: string) {
  const db = await getDb();
  const rows = await db.select().from(workspaceInvitations).where(and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.workspaceId, workspaceId))).limit(1);
  return rows[0] ?? null;
}

export async function isAlreadyMember(workspaceId: string, email: string) {
  const db = await getDb();
  const rows = await db.select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(users.email, normalizeEmail(email)),
    ))
    .limit(1);
  return rows.length > 0;
}

// The raw token leaves in the email. The row keeps only its hash, so a stolen
// database row cannot be replayed as an invitation link.
export async function createInvitation(input: {
  workspaceId: string;
  email: string;
  invitedByUserId: string;
}) {
  const db = await getDb();
  const raw = newAuthToken();
  const now = new Date();
  const id = newId();
  await db.insert(workspaceInvitations).values({
    id,
    workspaceId: input.workspaceId,
    email: normalizeEmail(input.email),
    tokenHash: hashAuthToken(raw),
    invitedByUserId: input.invitedByUserId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
    acceptedAt: null,
    revokedAt: null,
  });
  return { id, raw };
}

export async function replaceInvitationToken(id: string) {
  const db = await getDb();
  const raw = newAuthToken();
  const now = new Date();
  await db.update(workspaceInvitations)
    .set({ tokenHash: hashAuthToken(raw), expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS) })
    .where(eq(workspaceInvitations.id, id));
  return raw;
}

export async function revokeInvitation(id: string, workspaceId: string) {
  const db = await getDb();
  const changed = await db.update(workspaceInvitations)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(workspaceInvitations.id, id),
      eq(workspaceInvitations.workspaceId, workspaceId),
      isNull(workspaceInvitations.acceptedAt),
    ))
    .returning({ id: workspaceInvitations.id });
  return changed.length > 0;
}

export async function findUsableInvitation(rawToken: string) {
  const db = await getDb();
  const rows = await db.select().from(workspaceInvitations).where(eq(workspaceInvitations.tokenHash, hashAuthToken(rawToken))).limit(1);
  const row = rows[0];
  if (!row)
    return { ok: false as const, reason: 'invalid' as const };
  if (row.revokedAt)
    return { ok: false as const, reason: 'revoked' as const };
  if (row.acceptedAt)
    return { ok: false as const, reason: 'used' as const };
  if (row.expiresAt.getTime() <= Date.now())
    return { ok: false as const, reason: 'expired' as const };
  return { ok: true as const, invitation: row };
}

// One statement claims the invitation and one adds the membership. The claim
// carries its own guard, so two requests with the same token cannot both win.
export async function acceptInvitation(invitationId: string, workspaceId: string, userId: string) {
  const db = await getDb();
  const now = new Date();
  const claimed = await db.update(workspaceInvitations)
    .set({ acceptedAt: now })
    .where(and(eq(workspaceInvitations.id, invitationId), isNull(workspaceInvitations.acceptedAt)))
    .returning({ id: workspaceInvitations.id });
  if (!claimed.length)
    return false;

  const existing = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
  if (existing.length)
    return true;

  await db.insert(workspaceMembers).values({
    id: newId(),
    workspaceId,
    userId,
    role: 'MEMBER',
    createdAt: now,
    updatedAt: now,
  });
  return true;
}
