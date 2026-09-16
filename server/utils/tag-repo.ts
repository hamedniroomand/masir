import { and, desc, eq } from 'drizzle-orm';
import { linkTags, tags } from '#server/database/schema';
import { getDb, isUniqueViolation } from '#server/utils/db';
import { newId } from '#shared/id';

export class InvalidTagNameError extends Error {
  constructor() {
    super('invalid');
  }
}

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

export async function listTags(userId: string) {
  const db = await getDb();
  const rows = await db.select().from(tags).where(eq(tags.userId, userId)).orderBy(desc(tags.createdAt));
  return rows.map(tagToDto);
}

export async function findTagForUser(id: string, userId: string) {
  const db = await getDb();
  const rows = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function findTagByNormalizedName(userId: string, normalizedName: string) {
  const db = await getDb();
  const rows = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName))).limit(1);
  return rows[0] ?? null;
}

export async function createTag(userId: string, name: string) {
  const normalizedName = normalizeTagName(name);
  const existing = await findTagByNormalizedName(userId, normalizedName);
  if (existing)
    return existing;

  const db = await getDb();
  const id = newId();
  const displayName = name.trim();
  try {
    await db.insert(tags).values({
      id,
      userId,
      name: displayName,
      normalizedName,
      createdAt: new Date(),
    });
  }
  catch (e) {
    if (isUniqueViolation(e)) {
      const row = await findTagByNormalizedName(userId, normalizedName);
      if (row)
        return row;
    }
    throw e;
  }
  return findTagForUser(id, userId);
}

export async function renameTag(id: string, userId: string, name: string) {
  const normalizedName = normalizeTagName(name);
  const db = await getDb();
  try {
    await db.update(tags).set({ name: name.trim(), normalizedName }).where(and(eq(tags.id, id), eq(tags.userId, userId)));
  }
  catch (e) {
    if (isUniqueViolation(e))
      throw new InvalidTagNameError();
    throw e;
  }
  return findTagForUser(id, userId);
}

export async function deleteTag(id: string, userId: string) {
  const existing = await findTagForUser(id, userId);
  if (!existing)
    return false;
  const db = await getDb();
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
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

export async function setLinkTags(linkId: string, userId: string, names: string[]) {
  const db = await getDb();
  const uniqueNames = [...new Set(names.map(n => n.trim()).filter(Boolean))];
  const tagIds: string[] = [];
  for (const name of uniqueNames) {
    const tag = await createTag(userId, name);
    if (tag)
      tagIds.push(tag.id);
  }

  db.transaction((tx) => {
    tx.delete(linkTags).where(eq(linkTags.linkId, linkId)).run();
    for (const tagId of tagIds) {
      tx.insert(linkTags).values({ linkId, tagId }).run();
    }
  });

  return tagIds;
}
