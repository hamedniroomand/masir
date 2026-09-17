import { and, desc, eq } from 'drizzle-orm';
import { linkTags, tags } from '#server/database/schema';
import { getDb, isUniqueViolation, isUuid } from '#server/utils/db';
import { InvalidTagNameError, TagNameTakenError } from '#server/utils/errors';

export function normalizeTagName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed)
    throw new InvalidTagNameError();
  return trimmed.toLowerCase();
}

export function tagToDto(tag: typeof tags.$inferSelect) {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: tag.createdAt,
  };
}

export async function listTags(workspaceId: string) {
  const db = await getDb();
  const rows = await db.select().from(tags).where(eq(tags.workspaceId, workspaceId)).orderBy(desc(tags.createdAt));
  return rows.map(tagToDto);
}

export async function findTagForWorkspace(id: string, workspaceId: string) {
  if (!isUuid(id))
    return null;
  const db = await getDb();
  const rows = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.workspaceId, workspaceId))).limit(1);
  return rows[0] ?? null;
}

export async function findTagByNormalizedName(workspaceId: string, normalizedName: string) {
  const db = await getDb();
  const rows = await db.select().from(tags).where(and(eq(tags.workspaceId, workspaceId), eq(tags.normalizedName, normalizedName))).limit(1);
  return rows[0] ?? null;
}

export async function createTag(workspaceId: string, name: string) {
  const normalizedName = normalizeTagName(name);
  const existing = await findTagByNormalizedName(workspaceId, normalizedName);
  if (existing)
    return existing;

  const db = await getDb();
  try {
    const [created] = await db.insert(tags).values({
      workspaceId,
      name: name.trim(),
      normalizedName,
    }).returning();
    return created ?? null;
  }
  catch (error) {
    if (isUniqueViolation(error)) {
      const row = await findTagByNormalizedName(workspaceId, normalizedName);
      if (row)
        return row;
    }
    throw error;
  }
}

export async function renameTag(id: string, workspaceId: string, name: string) {
  const normalizedName = normalizeTagName(name);
  const db = await getDb();
  try {
    await db.update(tags).set({ name: name.trim(), normalizedName }).where(and(eq(tags.id, id), eq(tags.workspaceId, workspaceId)));
  }
  catch (error) {
    if (isUniqueViolation(error))
      throw new TagNameTakenError();
    throw error;
  }
  return findTagForWorkspace(id, workspaceId);
}

export async function deleteTag(id: string, workspaceId: string) {
  const existing = await findTagForWorkspace(id, workspaceId);
  if (!existing)
    return false;
  const db = await getDb();
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.workspaceId, workspaceId)));
  return true;
}

export async function tagsForLink(linkId: string) {
  const db = await getDb();
  return db.select({ tag: tags })
    .from(linkTags)
    .innerJoin(tags, eq(linkTags.tagId, tags.id))
    .where(eq(linkTags.linkId, linkId))
    .orderBy(tags.name);
}

export async function setLinkTags(linkId: string, workspaceId: string, names: string[]) {
  const db = await getDb();
  const uniqueNames = [...new Set(names.map(name => name.trim()).filter(Boolean))];
  const tagIds: string[] = [];
  for (const name of uniqueNames) {
    const tag = await createTag(workspaceId, name);
    if (tag)
      tagIds.push(tag.id);
  }

  await db.transaction(async (tx) => {
    await tx.delete(linkTags).where(eq(linkTags.linkId, linkId));
    if (tagIds.length)
      await tx.insert(linkTags).values(tagIds.map(tagId => ({ workspaceId, linkId, tagId })));
  });

  return tagIds;
}
