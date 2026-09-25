import type { Workspace, WorkspaceLinkPrefix } from '#server/database/schema';
import { and, desc, eq } from 'drizzle-orm';
import { workspaceLinkPrefixes, workspaces } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { isSlugTaken } from '#server/utils/link-repo';
import { RESERVED_SLUGS } from '#shared/slug';

const CACHE_TTL_MS = 60_000;
type CachedPrefixes = { expiresAt: number; prefixes: Set<string> };
const prefixCache = new Map<string, CachedPrefixes>();

export function clearRetainedPrefixCache(workspaceId?: string) {
  if (workspaceId) {
    prefixCache.delete(workspaceId);
  }
  else {
    prefixCache.clear();
  }
}

export async function listRetainedPrefixes(workspaceId: string): Promise<WorkspaceLinkPrefix[]> {
  const db = await getDb();
  return db.select()
    .from(workspaceLinkPrefixes)
    .where(and(
      eq(workspaceLinkPrefixes.workspaceId, workspaceId),
      eq(workspaceLinkPrefixes.state, 'retained'),
    ))
    .orderBy(desc(workspaceLinkPrefixes.createdAt));
}

export async function getRetainedPrefixesCached(workspaceId: string): Promise<Set<string>> {
  const cached = prefixCache.get(workspaceId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.prefixes;
  }
  const rows = await listRetainedPrefixes(workspaceId);
  const prefixes = new Set(rows.map(row => row.prefix));
  prefixCache.set(workspaceId, { expiresAt: now + CACHE_TTL_MS, prefixes });
  return prefixes;
}

export async function changeLinkPrefix(
  workspaceId: string,
  next: string | null,
  mode: 'preserve' | 'replace' = 'replace',
): Promise<Workspace> {
  const normalizedNext = next?.trim() ? next.trim() : null;

  if (normalizedNext) {
    if (RESERVED_SLUGS.has(normalizedNext) || await isSlugTaken(workspaceId, normalizedNext)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Prefix conflict',
        data: { reason: 'prefix_conflict' },
      });
    }
  }

  const db = await getDb();
  const [current] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' });
  }

  const oldPrefix = current.linkPrefix ?? '';
  const newPrefix = normalizedNext ?? '';

  if (oldPrefix === newPrefix) {
    return current;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (mode === 'preserve') {
      await tx.insert(workspaceLinkPrefixes).values({
        workspaceId,
        prefix: oldPrefix,
        state: 'retained',
        createdAt: now,
        revokedAt: null,
      }).onConflictDoUpdate({
        target: [workspaceLinkPrefixes.workspaceId, workspaceLinkPrefixes.prefix],
        set: {
          state: 'retained',
          revokedAt: null,
        },
      });
    }

    await tx.delete(workspaceLinkPrefixes).where(and(
      eq(workspaceLinkPrefixes.workspaceId, workspaceId),
      eq(workspaceLinkPrefixes.prefix, newPrefix),
    ));

    await tx.update(workspaces).set({
      linkPrefix: normalizedNext,
      updatedAt: now,
    }).where(eq(workspaces.id, workspaceId));
  });

  clearRetainedPrefixCache(workspaceId);

  const [updated] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' });
  }
  return updated;
}

export async function revokeLinkPrefix(workspaceId: string, prefix: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.update(workspaceLinkPrefixes)
    .set({
      state: 'revoked',
      revokedAt: new Date(),
    })
    .where(and(
      eq(workspaceLinkPrefixes.workspaceId, workspaceId),
      eq(workspaceLinkPrefixes.prefix, prefix),
      eq(workspaceLinkPrefixes.state, 'retained'),
    ))
    .returning();

  clearRetainedPrefixCache(workspaceId);
  return rows.length > 0;
}
