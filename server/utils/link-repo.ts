import type { DeploymentConfig } from '#shared/deployment';
import type { LinkTargeting } from '#shared/link-targeting';
import { and, desc, eq, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import { campaigns, clickEvents, linkAliases, links, linkTags, tags } from '#server/database/schema';
import { getDb, isUniqueViolation, isUuid } from '#server/utils/db';
import { AliasLimitError, SlugExhaustedError, SlugTakenError, VisitLimitBelowUsageError } from '#server/utils/errors';
import { invalidateLink, invalidateLinkById } from '#server/utils/link-cache';
import { normalizeTagName } from '#server/utils/tag-repo';
import { destinationHostFromUrl } from '#server/utils/url';
import { workspaceUrl } from '#shared/deployment';
import { MAX_ALIASES_PER_LINK } from '#shared/link-input';
import { deriveLinkStatus } from '#shared/link-status';
import { generateSlug, RESERVED_SLUGS } from '#shared/slug';

const countAll = sql<number>`count(*)::int`;

export function shortUrlFor(workspaceSlug: string, linkSlug: string) {
  const config = useRuntimeConfig();
  const base = workspaceUrl(workspaceSlug, config as unknown as DeploymentConfig);
  return `${base}/${linkSlug}`;
}

export function linkToDto(link: typeof links.$inferSelect, workspaceSlug: string, tagNames: string[] = [], aliases: string[] = []) {
  return {
    id: link.id,
    slug: link.slug,
    title: link.title,
    notes: link.notes,
    destinationUrl: link.destinationUrl,
    destinationHost: link.destinationHost,
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    expirationDestination: link.expirationDestination,
    limitDestination: link.limitDestination,
    scheduledDestination: link.scheduledDestination,
    targeting: link.targeting,
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
    aliases,
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

// Reserved names, every link slug including the deleted ones, and every alias.
// A slug that ever worked never returns to the pool, so an old QR code can
// never point at somebody else's destination.
export async function isSlugTaken(workspaceId: string, slug: string, exceptLinkId?: string) {
  if (RESERVED_SLUGS.has(slug))
    return true;
  const db = await getDb();
  const [linkRow] = await db.select({ id: links.id }).from(links).where(and(eq(links.workspaceId, workspaceId), eq(links.slug, slug))).limit(1);
  if (linkRow)
    return linkRow.id !== exceptLinkId;
  const [aliasRow] = await db.select({ linkId: linkAliases.linkId }).from(linkAliases).where(and(eq(linkAliases.workspaceId, workspaceId), eq(linkAliases.slug, slug))).limit(1);
  return aliasRow ? aliasRow.linkId !== exceptLinkId : false;
}

export async function aliasesForLinks(linkIds: string[]) {
  const map = new Map<string, string[]>();
  if (!linkIds.length)
    return map;
  const db = await getDb();
  const rows = await db.select({ linkId: linkAliases.linkId, slug: linkAliases.slug })
    .from(linkAliases)
    .where(and(inArray(linkAliases.linkId, linkIds), isNull(linkAliases.revokedAt)))
    .orderBy(linkAliases.createdAt);
  for (const row of rows) {
    const list = map.get(row.linkId) ?? [];
    list.push(row.slug);
    map.set(row.linkId, list);
  }
  return map;
}

export async function addAlias(workspaceId: string, linkId: string, slug: string) {
  const db = await getDb();
  const held = await db.select({ slug: linkAliases.slug }).from(linkAliases).where(and(eq(linkAliases.linkId, linkId), isNull(linkAliases.revokedAt)));
  if (held.length >= MAX_ALIASES_PER_LINK)
    throw new AliasLimitError();

  // The link may be taking back an address it revoked earlier.
  const restored = await db.update(linkAliases)
    .set({ revokedAt: null })
    .where(and(eq(linkAliases.workspaceId, workspaceId), eq(linkAliases.slug, slug), eq(linkAliases.linkId, linkId)))
    .returning({ slug: linkAliases.slug });
  if (!restored.length)
    await db.insert(linkAliases).values({ workspaceId, linkId, slug });

  invalidateLink(workspaceId, slug);
}

export async function removeAlias(workspaceId: string, linkId: string, slug: string) {
  const db = await getDb();
  const removed = await db.update(linkAliases)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(linkAliases.workspaceId, workspaceId),
      eq(linkAliases.slug, slug),
      eq(linkAliases.linkId, linkId),
      isNull(linkAliases.revokedAt),
    ))
    .returning({ slug: linkAliases.slug });
  if (!removed.length)
    return false;
  invalidateLink(workspaceId, slug);
  return true;
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
  const row = rows[0] ?? await findLinkByAlias(workspaceId, slug);
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

// Only a miss on the primary slug pays for this second query, and the caller
// caches the result under the requested slug.
async function findLinkByAlias(workspaceId: string, slug: string) {
  const db = await getDb();
  const rows = await db.select({
    link: links,
    utmMedium: campaigns.utmMedium,
    utmCampaign: campaigns.utmCampaign,
  })
    .from(linkAliases)
    .innerJoin(links, eq(linkAliases.linkId, links.id))
    .leftJoin(campaigns, eq(links.campaignId, campaigns.id))
    .where(and(
      eq(linkAliases.workspaceId, workspaceId),
      eq(linkAliases.slug, slug),
      isNull(linkAliases.revokedAt),
      isNull(links.deletedAt),
    ))
    .limit(1);
  return rows[0] ?? null;
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
  notes?: string | null;
  slug?: string;
  expiresAt?: Date | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  limitDestination?: string | null;
  scheduledDestination?: string | null;
  targeting?: LinkTargeting | null;
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
        notes: input.notes ?? null,
        destinationUrl: input.destinationUrl,
        destinationHost,
        expiresAt: input.expiresAt ?? null,
        startsAt: input.startsAt ?? null,
        expirationDestination: input.expirationDestination ?? null,
        limitDestination: input.limitDestination ?? null,
        scheduledDestination: input.scheduledDestination ?? null,
        targeting: input.targeting ?? null,
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
      // A visitor who reached this address before it existed left a cached miss
      // behind. Without this the new link answers 404 until that entry ages out.
      invalidateLink(input.workspaceId, created.slug);
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
      like(sql`lower(${links.notes})`, term),
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
  notes?: string | null;
  destinationUrl?: string;
  expiresAt?: Date | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  limitDestination?: string | null;
  scheduledDestination?: string | null;
  targeting?: LinkTargeting | null;
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
  if (patch.notes !== undefined)
    values.notes = patch.notes;
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
  if (patch.limitDestination !== undefined)
    values.limitDestination = patch.limitDestination;
  if (patch.scheduledDestination !== undefined)
    values.scheduledDestination = patch.scheduledDestination;
  if (patch.targeting !== undefined)
    values.targeting = patch.targeting;
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
  invalidateLinkById(id);
  return findLinkById(id, workspaceId);
}

// A soft delete. The row keeps its slug, so no other link in the workspace can
// take it, and the click history stays readable.
// The rename and the alias for the old slug are one transaction, so a full
// alias list can never leave the link renamed with its old address dead.
export async function renameLinkSlug(id: string, workspaceId: string, slug: string, keepOldSlug: boolean) {
  const existing = await findLinkById(id, workspaceId);
  if (!existing)
    return null;
  if (existing.slug === slug)
    return existing;

  const db = await getDb();
  await db.transaction(async (tx) => {
    if (keepOldSlug) {
      const held = await tx.select({ slug: linkAliases.slug }).from(linkAliases).where(and(eq(linkAliases.linkId, id), isNull(linkAliases.revokedAt)));
      if (held.length >= MAX_ALIASES_PER_LINK)
        throw new AliasLimitError();
    }
    // The old slug is written either way. A revoked row stops resolving but
    // keeps the address out of the pool, so nobody else can claim it.
    await tx.insert(linkAliases).values({
      workspaceId,
      linkId: id,
      slug: existing.slug,
      revokedAt: keepOldSlug ? null : new Date(),
    });
    // The new primary slug may be one of this link's own aliases.
    await tx.delete(linkAliases).where(and(eq(linkAliases.workspaceId, workspaceId), eq(linkAliases.slug, slug), eq(linkAliases.linkId, id)));
    await tx.update(links).set({ slug, updatedAt: new Date() }).where(and(eq(links.id, id), eq(links.workspaceId, workspaceId)));
  });

  invalidateLink(workspaceId, existing.slug);
  invalidateLink(workspaceId, slug);
  invalidateLinkById(id);
  return findLinkById(id, workspaceId);
}

export async function deleteLink(id: string, workspaceId: string) {
  const existing = await findLinkById(id, workspaceId);
  if (!existing)
    return false;

  const db = await getDb();
  await db.update(links)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(links.id, id), eq(links.workspaceId, workspaceId)));
  invalidateLink(workspaceId, existing.slug);
  invalidateLinkById(id);
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
