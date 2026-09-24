import type { DeploymentConfig } from '#shared/deployment';
import type { LinkTargeting } from '#shared/link-targeting';
import { and, desc, eq, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import { campaigns, clickEvents, linkAliases, links, linkTags, tags } from '#server/database/schema';
import { getDb, isUniqueViolation, isUuid } from '#server/utils/db';
import { AliasLimitError, AlreadyImportedError, SlugExhaustedError, SlugTakenError, VisitLimitBelowUsageError } from '#server/utils/errors';
import { invalidateLink, invalidateLinkById } from '#server/utils/link-cache';
import { normalizeTagName } from '#server/utils/tag-repo';
import { destinationHostFromUrl } from '#server/utils/url';
import { linkOrigin } from '#shared/deployment';
import { MAX_ALIASES_PER_LINK } from '#shared/link-input';
import { deriveLinkStatus } from '#shared/link-status';
import { generateSlug, RESERVED_SLUGS } from '#shared/slug';

const countAll = sql<number>`count(*)::int`;

export type ShortUrlWorkspace = { slug: string; linkPrefix: string | null };

export function shortUrlFor(workspace: ShortUrlWorkspace, linkSlug: string) {
  const config = useRuntimeConfig();
  const base = linkOrigin(workspace.slug, config as unknown as DeploymentConfig);
  return workspace.linkPrefix ? `${base}/${workspace.linkPrefix}/${linkSlug}` : `${base}/${linkSlug}`;
}

export function linkToDto(link: typeof links.$inferSelect, workspace: ShortUrlWorkspace, tagNames: string[] = [], aliases: string[] = []) {
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
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    utmTerm: link.utmTerm,
    utmContent: link.utmContent,
    tags: tagNames,
    aliases,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    shortUrl: shortUrlFor(workspace, link.slug),
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
// never point at somebody else's destination. A primary slug is taken even
// for its own link, so a link cannot hold itself as an alias. Only an alias
// the same link already holds is free for it, which lets a rename promote it.
export async function isSlugTaken(workspaceId: string, slug: string, exceptLinkId?: string) {
  if (RESERVED_SLUGS.has(slug))
    return true;
  const db = await getDb();
  const [linkRow] = await db.select({ id: links.id }).from(links).where(and(eq(links.workspaceId, workspaceId), eq(links.slug, slug))).limit(1);
  if (linkRow)
    return true;
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
  await db.transaction(async (tx) => {
    // The lock on the link row serialises the count and the insert, so two
    // requests cannot both pass the limit.
    // ponytail: a link slug and an alias slug share no constraint, so a link
    // created with this slug at the same moment still wins the race. A shared
    // slugs table would close it.
    await tx.select({ id: links.id }).from(links).where(eq(links.id, linkId)).for('update');
    const held = await tx.select({ slug: linkAliases.slug }).from(linkAliases).where(and(eq(linkAliases.linkId, linkId), isNull(linkAliases.revokedAt)));
    if (held.length >= MAX_ALIASES_PER_LINK)
      throw new AliasLimitError();

    // The link may be taking back an address it revoked earlier.
    const restored = await tx.update(linkAliases)
      .set({ revokedAt: null })
      .where(and(eq(linkAliases.workspaceId, workspaceId), eq(linkAliases.slug, slug), eq(linkAliases.linkId, linkId)))
      .returning({ slug: linkAliases.slug });
    if (!restored.length)
      await tx.insert(linkAliases).values({ workspaceId, linkId, slug });
  });

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
    utmMedium: sql<string | null>`coalesce(${links.utmMedium}, ${campaigns.utmMedium})`,
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
    utmMedium: sql<string | null>`coalesce(${links.utmMedium}, ${campaigns.utmMedium})`,
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

export async function findLinkByImportRow(importId: string, importRow: number) {
  if (!isUuid(importId))
    return null;
  const db = await getDb();
  const rows = await db.select().from(links).where(and(eq(links.importId, importId), eq(links.importRow, importRow))).limit(1);
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
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  importId?: string | null;
  importRow?: number | null;
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
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmTerm: input.utmTerm ?? null,
        utmContent: input.utmContent ?? null,
        importId: input.importId ?? null,
        importRow: input.importRow ?? null,
      }).returning();
      if (!created)
        throw new Error('insert failed');
      // A visitor who reached this address before it existed left a cached miss
      // behind. Without this the new link answers 404 until that entry ages out.
      invalidateLink(input.workspaceId, created.slug);
      return created;
    }
    catch (error: unknown) {
      if (isUniqueViolation(error)) {
        if (input.importId != null && input.importRow != null) {
          const existing = await findLinkByImportRow(input.importId, input.importRow);
          if (existing)
            throw new AlreadyImportedError(existing.id);
        }
        throw new SlugTakenError();
      }
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

export type LinkListQuery = {
  q?: string;
  destination?: string;
  status?: 'active' | 'disabled' | 'expired' | 'limit_reached' | 'scheduled';
  tags?: string[];
  campaignId?: string;
  createdBy?: string;
  // Defaults to false at the API. Without archived_at (Task R2.6), true matches
  // nothing and false applies no archive filter.
  archived?: boolean;
  page: number;
  perPage: number;
  sort: 'createdAt' | 'clicks';
};

export const BULK_LINK_CAP = 500;

export async function listLinks(workspaceId: string, query: LinkListQuery) {
  const db = await getDb();
  const now = new Date();
  const filters = [eq(links.workspaceId, workspaceId), isNull(links.deletedAt)];
  const notExpired = anyOf(sql`${links.expiresAt} IS NULL`, sql`${links.expiresAt} > ${now}`);
  const underVisitLimit = anyOf(sql`${links.maximumVisits} IS NULL`, sql`${links.clickCount} < ${links.maximumVisits}`);
  const started = anyOf(sql`${links.startsAt} IS NULL`, sql`${links.startsAt} <= ${now}`);
  const enabled = eq(links.isEnabled, true);

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    filters.push(anyOf(
      like(sql`lower(${links.title})`, term),
      like(sql`lower(${links.slug})`, term),
      like(sql`lower(${links.destinationHost})`, term),
      like(sql`lower(${links.notes})`, term),
    ));
  }

  if (query.destination)
    filters.push(eq(links.destinationUrl, query.destination));

  if (query.campaignId) {
    if (isUuid(query.campaignId))
      filters.push(eq(links.campaignId, query.campaignId));
    else
      filters.push(sql`1=0`);
  }

  if (query.createdBy) {
    if (isUuid(query.createdBy))
      filters.push(eq(links.createdBy, query.createdBy));
    else
      filters.push(sql`1=0`);
  }

  // archived_at lands in Task R2.6. Until then every live row is not archived.
  if (query.archived === true)
    filters.push(sql`1=0`);

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

  // Each row adds the negation of the row above it. The order must stay the
  // same as the guard order in deriveLinkStatus().
  const statusFilters = {
    disabled: [eq(links.isEnabled, false)],
    expired: [enabled, sql`${links.expiresAt} IS NOT NULL AND ${links.expiresAt} <= ${now}`],
    limit_reached: [enabled, notExpired, sql`${links.maximumVisits} IS NOT NULL AND ${links.clickCount} >= ${links.maximumVisits}`],
    scheduled: [enabled, notExpired, underVisitLimit, sql`${links.startsAt} IS NOT NULL AND ${links.startsAt} > ${now}`],
    active: [enabled, notExpired, underVisitLimit, started],
  };

  if (query.status)
    filters.push(...statusFilters[query.status]);

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
  capAlertSentAt?: Date | null;
  expiryAlertSentAt?: Date | null;
  maximumVisits?: number | null;
  passwordHash?: string | null;
  isEnabled?: boolean;
  campaignId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
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
  if (patch.capAlertSentAt !== undefined)
    values.capAlertSentAt = patch.capAlertSentAt;
  if (patch.expiryAlertSentAt !== undefined)
    values.expiryAlertSentAt = patch.expiryAlertSentAt;
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
  if (patch.utmMedium !== undefined)
    values.utmMedium = patch.utmMedium;
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
    await tx.select({ id: links.id }).from(links).where(eq(links.id, id)).for('update');
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

// Null means the visit was refused. A number is the new count, which the
// caller needs for the cap alert without reading the row again.
export async function consumeVisit(linkId: string): Promise<number | null> {
  const db = await getDb();
  const updated = await db.update(links)
    .set({ clickCount: sql`${links.clickCount} + 1` })
    .where(and(
      eq(links.id, linkId),
      isNull(links.deletedAt),
      or(isNull(links.maximumVisits), sql`${links.clickCount} < ${links.maximumVisits}`),
    ))
    .returning({ clickCount: links.clickCount });
  return updated[0]?.clickCount ?? null;
}

export async function countClickEvents(linkId: string) {
  const db = await getDb();
  const rows = await db.select({ n: countAll }).from(clickEvents).where(eq(clickEvents.linkId, linkId));
  return rows[0]?.n ?? 0;
}

export async function countLiveLinks(workspaceId: string) {
  const db = await getDb();
  const [row] = await db.select({ n: countAll })
    .from(links)
    .where(and(eq(links.workspaceId, workspaceId), isNull(links.deletedAt)));
  return row?.n ?? 0;
}
