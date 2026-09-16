import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { campaigns, clickEvents, links, reservedSlugs } from '#server/database/schema';
import { getDb, isUniqueViolation } from '#server/utils/db';
import { invalidateLink } from '#server/utils/link-cache';
import { destinationHostFromUrl } from '#server/utils/url';
import { newId } from '#shared/id';
import { deriveLinkStatus } from '#shared/link-status';
import { generateSlug } from '#shared/slug';

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
    startsAt: link.startsAt,
    expirationDestination: link.expirationDestination,
    maximumVisits: link.maximumVisits,
    successfulVisitCount: link.successfulVisitCount,
    isProtected: link.passwordHash != null && link.passwordHash.length > 0,
    clickCount: link.clickCount,
    campaignId: link.campaignId,
    utmSource: link.utmSource,
    utmContent: link.utmContent,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    shortUrl: shortUrlFor(link.slug),
    status: deriveLinkStatus({
      isEnabled: link.isEnabled,
      expiresAt: link.expiresAt,
      startsAt: link.startsAt,
      maximumVisits: link.maximumVisits,
      successfulVisitCount: link.successfulVisitCount,
    }),
  };
}

export async function findLinkBySlug(slug: string) {
  const db = await getDb();
  const rows = await db.select({
    link: links,
    utmMedium: campaigns.utmMedium,
    utmCampaign: campaigns.utmCampaign,
  })
    .from(links)
    .leftJoin(campaigns, eq(links.campaignId, campaigns.id))
    .where(eq(links.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row)
    return null;
  return { ...row.link, utmMedium: row.utmMedium, utmCampaign: row.utmCampaign };
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
  startsAt?: Date | null;
  expirationDestination?: string | null;
  maximumVisits?: number | null;
  campaignId?: string | null;
  utmSource?: string | null;
  utmContent?: string | null;
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
        startsAt: input.startsAt ?? null,
        expirationDestination: input.expirationDestination ?? null,
        maximumVisits: input.maximumVisits ?? null,
        successfulVisitCount: 0,
        campaignId: input.campaignId ?? null,
        utmSource: input.utmSource ?? null,
        utmContent: input.utmContent ?? null,
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

export async function listLinks(userId: string, query: {
  q?: string;
  status?: 'active' | 'disabled' | 'expired' | 'limit_reached' | 'scheduled';
  page: number;
  perPage: number;
  sort: 'createdAt' | 'clicks';
}) {
  const db = await getDb();
  const now = Date.now();
  const filters = [eq(links.userId, userId)];
  const notExpired = or(sql`${links.expiresAt} IS NULL`, sql`${links.expiresAt} > ${now}`)!;
  const underVisitLimit = or(sql`${links.maximumVisits} IS NULL`, sql`${links.successfulVisitCount} < ${links.maximumVisits}`)!;
  const started = or(sql`${links.startsAt} IS NULL`, sql`${links.startsAt} <= ${now}`)!;

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    filters.push(or(
      like(sql`lower(${links.title})`, term),
      like(sql`lower(${links.slug})`, term),
      like(sql`lower(${links.destinationHost})`, term),
    )!);
  }

  if (query.status === 'disabled') {
    filters.push(eq(links.isEnabled, false));
  }
  else if (query.status === 'expired') {
    filters.push(eq(links.isEnabled, true));
    filters.push(sql`${links.expiresAt} IS NOT NULL AND ${links.expiresAt} <= ${now}`);
  }
  else if (query.status === 'limit_reached') {
    filters.push(eq(links.isEnabled, true));
    filters.push(notExpired);
    filters.push(sql`${links.maximumVisits} IS NOT NULL AND ${links.successfulVisitCount} >= ${links.maximumVisits}`);
  }
  else if (query.status === 'scheduled') {
    filters.push(eq(links.isEnabled, true));
    filters.push(notExpired);
    filters.push(underVisitLimit);
    filters.push(sql`${links.startsAt} IS NOT NULL AND ${links.startsAt} > ${now}`);
  }
  else if (query.status === 'active') {
    filters.push(eq(links.isEnabled, true));
    filters.push(notExpired);
    filters.push(underVisitLimit);
    filters.push(started);
  }

  const where = and(...filters);
  const orderBy = query.sort === 'clicks'
    ? desc(links.clickCount)
    : desc(links.createdAt);

  const totalRows = await db.select({ total: countAll }).from(links).where(where);
  const total = totalRows[0]?.total ?? 0;
  const items = await db.select().from(links).where(where).orderBy(orderBy).limit(query.perPage).offset((query.page - 1) * query.perPage);

  return { items, total };
}

export async function updateLink(id: string, userId: string, patch: {
  title?: string | null;
  destinationUrl?: string;
  expiresAt?: Date | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  maximumVisits?: number | null;
  isEnabled?: boolean;
  campaignId?: string | null;
  utmSource?: string | null;
  utmContent?: string | null;
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
  if (patch.startsAt !== undefined)
    values.startsAt = patch.startsAt;
  if (patch.expirationDestination !== undefined)
    values.expirationDestination = patch.expirationDestination;
  if (patch.maximumVisits !== undefined)
    values.maximumVisits = patch.maximumVisits;
  if (patch.isEnabled !== undefined)
    values.isEnabled = patch.isEnabled;
  if (patch.campaignId !== undefined)
    values.campaignId = patch.campaignId;
  if (patch.utmSource !== undefined)
    values.utmSource = patch.utmSource;
  if (patch.utmContent !== undefined)
    values.utmContent = patch.utmContent;

  await db.update(links).set(values).where(eq(links.id, id));
  invalidateLink(existing.slug);
  return findLinkByIdForUser(id, userId);
}

export async function deleteLink(id: string, userId: string) {
  const existing = await findLinkByIdForUser(id, userId);
  if (!existing)
    return false;

  const db = await getDb();
  db.transaction((tx) => {
    tx.insert(reservedSlugs).values({ slug: existing.slug, releasedAt: new Date() }).run();
    tx.delete(links).where(eq(links.id, id)).run();
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

export async function consumeVisit(linkId: string): Promise<boolean> {
  const db = await getDb();
  const updated = await db.update(links)
    .set({ successfulVisitCount: sql`${links.successfulVisitCount} + 1` })
    .where(and(
      eq(links.id, linkId),
      or(isNull(links.maximumVisits), sql`${links.successfulVisitCount} < ${links.maximumVisits}`),
    ))
    .returning({ id: links.id });
  return updated.length > 0;
}

export async function countClickEvents(linkId: string) {
  const db = await getDb();
  const rows = await db.select({ n: countAll }).from(clickEvents).where(eq(clickEvents.linkId, linkId));
  return rows[0]?.n ?? 0;
}
