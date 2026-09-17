import type { DeploymentConfig } from '#shared/deployment';
import { and, desc, eq, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import { campaigns, clickEvents, links, linkTags, tags } from '#server/database/schema';
import { getDb, isUniqueViolation, isUuid } from '#server/utils/db';
import { SlugExhaustedError, SlugTakenError, VisitLimitBelowUsageError } from '#server/utils/errors';
import { invalidateLink } from '#server/utils/link-cache';
import { normalizeTagName } from '#server/utils/tag-repo';
import { destinationHostFromUrl } from '#server/utils/url';
import { workspaceUrl } from '#shared/deployment';
import { deriveLinkStatus } from '#shared/link-status';
import { generateSlug } from '#shared/slug';

const countAll = sql<number>`count(*)::int`;

export function shortUrlFor(workspaceSlug: string, linkSlug: string) {
  const config = useRuntimeConfig();
  const base = workspaceUrl(workspaceSlug, config as unknown as DeploymentConfig);
  return `${base}/${linkSlug}`;
}

export function linkToDto(link: typeof links.$inferSelect, workspaceSlug: string, tagNames: string[] = []) {
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
    // One column serves both names. successfulVisitCount stays in the API so
    // the frontend does not change.
    successfulVisitCount: link.clickCount,
    isProtected: link.passwordHash != null && link.passwordHash.length > 0,
    clickCount: link.clickCount,
    campaignId: link.campaignId,
    utmSource: link.utmSource,
    utmCampaign: link.utmCampaign,
    utmTerm: link.utmTerm,
    utmContent: link.utmContent,
    tags: tagNames,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    shortUrl: shortUrlFor(workspaceSlug, link.slug),
    status: deriveLinkStatus({
      isEnabled: link.isEnabled,
      expiresAt: link.expiresAt,
      startsAt: link.startsAt,
      maximumVisits: link.maximumVisits,
      clickCount: link.clickCount,
    }),
  };
}

export async function findLinkBySlug(workspaceId: string, slug: string) {
  const db = await getDb();
  const rows = await db.select({
    link: links,
    utmMedium: campaigns.utmMedium,
    utmCampaign: campaigns.utmCampaign,
  })
    .from(links)
    .leftJoin(campaigns, eq(links.campaignId, campaigns.id))
    .where(and(eq(links.workspaceId, workspaceId), eq(links.slug, slug), isNull(links.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row)
    return null;
  // A check constraint lets only one side hold utm_campaign, so this picks the
  // one that is set, it never resolves a conflict.
  return {
    ...row.link,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign ?? row.link.utmCampaign,
  };
}

export async function findLinkById(id: string, workspaceId: string) {
  if (!isUuid(id))
    return null;
  const db = await getDb();
  const rows = await db.select().from(links).where(and(
    eq(links.id, id),
    eq(links.workspaceId, workspaceId),
    isNull(links.deletedAt),
  )).limit(1);
  return rows[0] ?? null;
}

export async function createLink(input: {
  workspaceId: string;
  createdBy: string;
  destinationUrl: string;
  title?: string | null;
  slug?: string;
  expiresAt?: Date | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  maximumVisits?: number | null;
  passwordHash?: string | null;
  campaignId?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  slugGenerator?: () => string;
}) {
  const db = await getDb();
  const destinationHost = destinationHostFromUrl(input.destinationUrl);
  const gen = input.slugGenerator ?? (() => generateSlug());

  // The unique index has no partial clause, so a deleted link still holds its
  // slug and this covers it.
  async function attempt(slug: string) {
    try {
      const [created] = await db.insert(links).values({
        workspaceId: input.workspaceId,
        createdBy: input.createdBy,
        slug,
        title: input.title ?? null,
        destinationUrl: input.destinationUrl,
        destinationHost,
        expiresAt: input.expiresAt ?? null,
        startsAt: input.startsAt ?? null,
        expirationDestination: input.expirationDestination ?? null,
        maximumVisits: input.maximumVisits ?? null,
        passwordHash: input.passwordHash ?? null,
        campaignId: input.campaignId ?? null,
        utmSource: input.utmSource ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmTerm: input.utmTerm ?? null,
        utmContent: input.utmContent ?? null,
      }).returning();
      if (!created)
        throw new Error('insert failed');
      return created;
    }
    catch (error: unknown) {
      if (isUniqueViolation(error))
        throw new SlugTakenError();
      throw error;
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
    catch (error) {
      if (!(error instanceof SlugTakenError))
        throw error;
      if (i >= 2)
        length++;
    }
  }
  throw new SlugExhaustedError();
}

export async function tagNamesByLinkIds(linkIds: string[]) {
  const map = new Map<string, string[]>();
  if (!linkIds.length)
    return map;
  const db = await getDb();
  const rows = await db.select({ linkId: linkTags.linkId, name: tags.name })
    .from(linkTags)
    .innerJoin(tags, eq(linkTags.tagId, tags.id))
    .where(inArray(linkTags.linkId, linkIds));
  for (const row of rows) {
    const list = map.get(row.linkId) ?? [];
    list.push(row.name);
    map.set(row.linkId, list);
  }
  return map;
}

export async function listLinks(workspaceId: string, query: {
  q?: string;
  status?: 'active' | 'disabled' | 'expired' | 'limit_reached' | 'scheduled';
  tags?: string[];
  page: number;
  perPage: number;
  sort: 'createdAt' | 'clicks';
}) {
  const db = await getDb();
  const now = new Date();
  const filters = [eq(links.workspaceId, workspaceId), isNull(links.deletedAt)];
  const notExpired = anyOf(sql`${links.expiresAt} IS NULL`, sql`${links.expiresAt} > ${now}`);
  const underVisitLimit = anyOf(sql`${links.maximumVisits} IS NULL`, sql`${links.clickCount} < ${links.maximumVisits}`);
  const started = anyOf(sql`${links.startsAt} IS NULL`, sql`${links.startsAt} <= ${now}`);

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    filters.push(anyOf(
      like(sql`lower(${links.title})`, term),
      like(sql`lower(${links.slug})`, term),
      like(sql`lower(${links.destinationHost})`, term),
    ));
  }

  if (query.tags?.length) {
    for (const raw of query.tags) {
      let normalized: string;
      try {
        normalized = normalizeTagName(raw);
      }
      catch {
        filters.push(sql`1=0`);
        continue;
      }
      filters.push(sql`exists (
        select 1 from link_tags lt
        inner join tags t on t.id = lt.tag_id
        where lt.link_id = ${links.id}
          and lt.workspace_id = ${workspaceId}
          and t.workspace_id = ${workspaceId}
          and t.normalized_name = ${normalized}
      )`);
    }
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
    filters.push(sql`${links.maximumVisits} IS NOT NULL AND ${links.clickCount} >= ${links.maximumVisits}`);
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

export async function updateLink(id: string, workspaceId: string, patch: {
  title?: string | null;
  destinationUrl?: string;
  expiresAt?: Date | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  maximumVisits?: number | null;
  passwordHash?: string | null;
  isEnabled?: boolean;
  campaignId?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}) {
  const existing = await findLinkById(id, workspaceId);
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
  if (patch.passwordHash !== undefined)
    values.passwordHash = patch.passwordHash;
  if (patch.isEnabled !== undefined)
    values.isEnabled = patch.isEnabled;
  if (patch.campaignId !== undefined)
    values.campaignId = patch.campaignId;
  if (patch.utmSource !== undefined)
    values.utmSource = patch.utmSource;
  if (patch.utmCampaign !== undefined)
    values.utmCampaign = patch.utmCampaign;
  if (patch.utmTerm !== undefined)
    values.utmTerm = patch.utmTerm;
  if (patch.utmContent !== undefined)
    values.utmContent = patch.utmContent;

  // A concurrent redirect can raise the click count after the caller read it.
  // The guard makes the limit check and the write one statement.
  // The workspace stays in the guard. Without it the update would reach
  // another workspace's row of the same id.
  const guard = patch.maximumVisits != null
    ? and(eq(links.id, id), eq(links.workspaceId, workspaceId), isNull(links.deletedAt), lte(links.clickCount, patch.maximumVisits))
    : and(eq(links.id, id), eq(links.workspaceId, workspaceId), isNull(links.deletedAt));

  const changed = await db.update(links).set(values).where(guard).returning({ id: links.id });
  if (!changed.length) {
    if (!await findLinkById(id, workspaceId))
      return null;
    throw new VisitLimitBelowUsageError();
  }

  invalidateLink(workspaceId, existing.slug);
  return findLinkById(id, workspaceId);
}

// A soft delete. The row keeps its slug, so no other link in the workspace can
// take it, and the click history stays readable.
export async function deleteLink(id: string, workspaceId: string) {
  const existing = await findLinkById(id, workspaceId);
  if (!existing)
    return false;

  const db = await getDb();
  await db.update(links)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(links.id, id), eq(links.workspaceId, workspaceId)));
  invalidateLink(workspaceId, existing.slug);
  return true;
}

export async function consumeVisit(linkId: string): Promise<boolean> {
  const db = await getDb();
  const updated = await db.update(links)
    .set({ clickCount: sql`${links.clickCount} + 1` })
    .where(and(
      eq(links.id, linkId),
      isNull(links.deletedAt),
      or(isNull(links.maximumVisits), sql`${links.clickCount} < ${links.maximumVisits}`),
    ))
    .returning({ id: links.id });
  return updated.length > 0;
}

export async function countClickEvents(linkId: string) {
  const db = await getDb();
  const rows = await db.select({ n: countAll }).from(clickEvents).where(eq(clickEvents.linkId, linkId));
  return rows[0]?.n ?? 0;
}
