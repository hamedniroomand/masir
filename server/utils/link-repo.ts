// @ts-nocheck drizzle query types vs Nuxt auto-imports
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { clickEvents, links, reservedSlugs } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { invalidateLink } from '#server/utils/link-cache';
import { generateSlug } from '#server/utils/slug';
import { destinationHostFromUrl } from '#server/utils/url';
import { newId } from '#shared/id';
import { deriveLinkStatus } from '#shared/link-status';

const countAll = sql<number>`count(*)`;

export function shortUrlFor(slug: string) {
  const { public: { shortDomain } } = useRuntimeConfig();
  const base = shortDomain.replace(/\/$/, '');
  return `${base}/${slug}`;
}

export function linkToDto(link: typeof links.$inferSelect) {
  return {
    id: link.id,
    slug: link.slug,
    title: link.title,
    destinationUrl: link.destinationUrl,
    destinationHost: link.destinationHost,
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    clickCount: link.clickCount,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    shortUrl: shortUrlFor(link.slug),
    status: deriveLinkStatus({
      isEnabled: link.isEnabled,
      expiresAt: link.expiresAt,
    }),
  };
}

export async function findLinkBySlug(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(links).where(eq(links.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function findLinkByIdForUser(id: string, userId: string) {
  const db = await getDb();
  const rows = await db.select().from(links).where(and(eq(links.id, id), eq(links.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function isSlugReserved(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(reservedSlugs).where(eq(reservedSlugs.slug, slug)).limit(1);
  return rows.length > 0;
}

export async function createLink(input: {
  userId: string;
  destinationUrl: string;
  title?: string | null;
  slug?: string;
  expiresAt?: Date | null;
  slugGenerator?: () => string;
}) {
  const db = await getDb();
  const now = new Date();
  const destinationHost = destinationHostFromUrl(input.destinationUrl);
  const gen = input.slugGenerator ?? (() => generateSlug());

  async function attempt(slug: string) {
    if (await isSlugReserved(slug))
      throw new SlugTakenError();
    try {
      const id = newId();
      await db.insert(links).values({
        id,
        userId: input.userId,
        slug,
        title: input.title ?? null,
        destinationUrl: input.destinationUrl,
        destinationHost,
        isEnabled: true,
        expiresAt: input.expiresAt ?? null,
        clickCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      const row = await findLinkByIdForUser(id, input.userId);
      if (!row)
        throw new Error('insert failed');
      return row;
    }
    catch (e: unknown) {
      if (isUniqueViolation(e))
        throw new SlugTakenError();
      throw e;
    }
  }

  if (input.slug) {
    return attempt(input.slug);
  }

  let length = 7;
  for (let i = 0; i < 5; i++) {
    const slug = input.slugGenerator ? gen() : generateSlug(length);
    try {
      return await attempt(slug);
    }
    catch (e) {
      if (!(e instanceof SlugTakenError))
        throw e;
      if (i >= 2)
        length++;
    }
  }
  throw new SlugExhaustedError();
}

export class SlugTakenError extends Error {
  constructor() {
    super('taken');
  }
}

export class SlugExhaustedError extends Error {
  constructor() {
    super('exhausted');
  }
}

function isUniqueViolation(e: unknown) {
  return e instanceof Error && /unique/i.test(e.message);
}

export async function listLinks(userId: string, query: {
  q?: string;
  status?: 'active' | 'disabled' | 'expired';
  page: number;
  perPage: number;
  sort: 'createdAt' | 'clicks';
}) {
  const db = await getDb();
  const now = Date.now();
  const filters = [eq(links.userId, userId)];

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    filters.push(or(
      like(sql`lower(${links.title})`, term),
      like(sql`lower(${links.slug})`, term),
      like(sql`lower(${links.destinationHost})`, term),
    )!);
  }

  if (query.status === 'expired') {
    filters.push(sql`${links.expiresAt} IS NOT NULL AND ${links.expiresAt} <= ${now}`);
  }
  else if (query.status === 'disabled') {
    filters.push(eq(links.isEnabled, false));
    filters.push(or(sql`${links.expiresAt} IS NULL`, sql`${links.expiresAt} > ${now}`)!);
  }
  else if (query.status === 'active') {
    filters.push(eq(links.isEnabled, true));
    filters.push(or(sql`${links.expiresAt} IS NULL`, sql`${links.expiresAt} > ${now}`)!);
  }

  const where = and(...filters);
  const orderBy = query.sort === 'clicks'
    ? desc(links.clickCount)
    : desc(links.createdAt);

  const [{ total }] = await db.select({ total: countAll }).from(links).where(where);
  const items = await db.select().from(links).where(where).orderBy(orderBy).limit(query.perPage).offset((query.page - 1) * query.perPage);

  return { items, total };
}

export async function updateLink(id: string, userId: string, patch: {
  title?: string | null;
  destinationUrl?: string;
  expiresAt?: Date | null;
  isEnabled?: boolean;
}) {
  const existing = await findLinkByIdForUser(id, userId);
  if (!existing)
    return null;

  const db = await getDb();
  const values: Partial<typeof links.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined)
    values.title = patch.title;
  if (patch.destinationUrl !== undefined) {
    values.destinationUrl = patch.destinationUrl;
    values.destinationHost = destinationHostFromUrl(patch.destinationUrl);
  }
  if (patch.expiresAt !== undefined)
    values.expiresAt = patch.expiresAt;
  if (patch.isEnabled !== undefined)
    values.isEnabled = patch.isEnabled;

  await db.update(links).set(values).where(eq(links.id, id));
  invalidateLink(existing.slug);
  return findLinkByIdForUser(id, userId);
}

export async function deleteLink(id: string, userId: string) {
  const existing = await findLinkByIdForUser(id, userId);
  if (!existing)
    return false;

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(reservedSlugs).values({ slug: existing.slug, releasedAt: new Date() });
    await tx.delete(links).where(eq(links.id, id));
  });
  invalidateLink(existing.slug);
  return true;
}

export async function adminDisableLink(linkId: string) {
  const db = await getDb();
  const rows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  const link = rows[0];
  if (!link)
    return null;
  await db.update(links).set({ isEnabled: false, updatedAt: new Date() }).where(eq(links.id, linkId));
  invalidateLink(link.slug);
  return link;
}

export async function countClickEvents(linkId: string) {
  const db = await getDb();
  const [{ n }] = await db.select({ n: countAll }).from(clickEvents).where(eq(clickEvents.linkId, linkId));
  return n;
}
