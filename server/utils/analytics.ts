import type { SQL } from 'drizzle-orm';
import type { ClickEventOutcome } from '#server/database/schema';
import type { RequestMeta } from '#server/utils/request-meta';
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { campaigns, clickEvents, links } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

// Postgres returns bigint as a string. The cast keeps every count a number.
const countAll = sql<number>`count(*)::int`;
const countDistinctVisitors = sql<number>`count(distinct ${clickEvents.visitorHash})::int`;

export async function recordEvent(
  workspaceId: string,
  linkId: string,
  meta: RequestMeta,
  outcome: ClickEventOutcome,
  visitorHash: string | null = null,
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(clickEvents).values({
      id: newId(),
      workspaceId,
      linkId,
      createdAt: new Date(),
      referrerHost: meta.referrerHost,
      country: meta.country,
      deviceCategory: meta.deviceCategory,
      browserCategory: meta.browserCategory,
      outcome,
      isBot: meta.isBot,
      botCategory: meta.botCategory,
      visitorHash,
    });
    if (outcome === 'redirect_success') {
      await tx.update(links)
        .set({ clickCount: sql`${links.clickCount} + 1` })
        .where(and(eq(links.id, linkId), eq(links.workspaceId, workspaceId)));
    }
  });
}

type Period = '24h' | '7d' | '30d' | 'all';
type TrafficClass = 'human' | 'bot' | 'all';

// A legacy row has no outcome. The old redirect path wrote a row only after a
// successful redirect. A legacy row is thus a click. Its bot data is unknown.
const humanFilter = or(eq(clickEvents.outcome, 'redirect_success'), isNull(clickEvents.outcome))!;

function trafficFilter(traffic: TrafficClass): SQL {
  if (traffic === 'human')
    return humanFilter;
  if (traffic === 'bot')
    return eq(clickEvents.outcome, 'bot_request');
  return sql`1=1`;
}

async function classificationBoundary(scope: SQL, inWindow: SQL) {
  const db = await getDb();
  const startRows = await db.select({ at: sql<Date | null>`min(${clickEvents.createdAt})` })
    .from(clickEvents)
    .where(and(scope, sql`${clickEvents.outcome} IS NOT NULL`));
  const legacyRows = await db.select({ n: countAll })
    .from(clickEvents)
    .where(and(scope, isNull(clickEvents.outcome), inWindow));
  const startAt = startRows[0]?.at ?? null;
  return {
    classificationAvailableFrom: startAt == null ? null : new Date(startAt).toISOString(),
    periodCoversLegacy: (legacyRows[0]?.n ?? 0) > 0,
  };
}

export async function getLinkAnalytics(linkId: string, workspaceId: string, period: Period, traffic: TrafficClass = 'human') {
  const db = await getDb();
  const linkRows = await db.select().from(links).where(and(eq(links.id, linkId), eq(links.workspaceId, workspaceId))).limit(1);
  const link = linkRows[0];
  if (!link)
    return null;

  const windowStart = periodStart(period, Date.now());
  const inWindow = windowFilter(windowStart);
  const scope = eq(clickEvents.linkId, linkId);
  const uniqueRows = await db.select({ n: countDistinctVisitors }).from(clickEvents).where(and(
    scope,
    eq(clickEvents.outcome, 'redirect_success'),
    sql`${clickEvents.visitorHash} IS NOT NULL`,
    inWindow,
  ));
  const uniqueVisitors = uniqueRows[0]?.n ?? 0;

  const botRows = await db.select({ n: countAll }).from(clickEvents).where(and(
    scope,
    eq(clickEvents.outcome, 'bot_request'),
    inWindow,
  ));
  const botRequests = botRows[0]?.n ?? 0;

  const remainingVisits = link.maximumVisits != null
    ? Math.max(0, link.maximumVisits - link.successfulVisitCount)
    : null;

  const analytics = await buildAnalytics(scope, period, link.createdAt.getTime(), traffic);
  const boundary = await classificationBoundary(scope, inWindow);

  return {
    totalClicks: link.clickCount,
    uniqueVisitors,
    botRequests,
    remainingVisits,
    maximumVisits: link.maximumVisits,
    successfulVisitCount: link.successfulVisitCount,
    ...boundary,
    ...analytics,
  };
}

export async function getCampaignAnalytics(campaignId: string, workspaceId: string, period: Period) {
  const db = await getDb();
  const campaignRows = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId))).limit(1);
  const campaign = campaignRows[0];
  if (!campaign)
    return null;

  const linkRows = await db.select({
    id: links.id,
    slug: links.slug,
    title: links.title,
    utmSource: links.utmSource,
    utmContent: links.utmContent,
    clickCount: links.clickCount,
  }).from(links).where(and(eq(links.campaignId, campaignId), eq(links.workspaceId, workspaceId)));

  if (!linkRows.length) {
    return {
      totalClicks: 0,
      linkCount: 0,
      bySource: [],
      topLinks: [],
      ...await buildAnalytics(sql`1=0`, period, campaign.createdAt.getTime(), 'human'),
    };
  }

  const scope = inArray(clickEvents.linkId, linkRows.map(r => r.id));
  const windowStart = periodStart(period, Date.now());

  const sourceRows = await db.select({
    label: links.utmSource,
    count: countAll,
  }).from(clickEvents).innerJoin(links, eq(clickEvents.linkId, links.id)).where(and(scope, windowFilter(windowStart), humanFilter)).groupBy(links.utmSource).orderBy(desc(countAll));

  const linkClickRows = await db.select({
    id: clickEvents.linkId,
    count: countAll,
  }).from(clickEvents).where(and(scope, windowFilter(windowStart), humanFilter)).groupBy(clickEvents.linkId);
  const periodByLink = new Map(linkClickRows.map(r => [r.id, Number(r.count)]));

  return {
    totalClicks: linkRows.reduce((sum, r) => sum + r.clickCount, 0),
    linkCount: linkRows.length,
    bySource: sourceRows.map(r => ({ label: r.label ?? 'not set', count: Number(r.count) })),
    topLinks: linkRows
      .map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        utmSource: r.utmSource,
        utmContent: r.utmContent,
        totalClicks: r.clickCount,
        periodClicks: periodByLink.get(r.id) ?? 0,
      }))
      .sort((a, b) => b.periodClicks - a.periodClicks || b.totalClicks - a.totalClicks),
    ...await buildAnalytics(scope, period, campaign.createdAt.getTime(), 'human'),
  };
}

async function buildAnalytics(scope: SQL, period: Period, createdAtMs: number, traffic: TrafficClass) {
  const db = await getDb();
  const now = Date.now();
  const windowStart = periodStart(period, now);
  const hourly = period === '24h';
  const inWindow = windowFilter(windowStart);
  const trafficWhere = trafficFilter(traffic);

  const periodClicksRows = await db.select({ n: countAll }).from(clickEvents).where(and(scope, inWindow, trafficWhere));
  const periodClicks = periodClicksRows[0]?.n ?? 0;

  const bucketMs = hourly ? 3600_000 : 86_400_000;
  const start = windowStart ?? createdAtMs;

  // The buckets must stay UTC. zeroFillSeries builds its labels from UTC too.
  // The format stays a literal. A bound parameter makes GROUP BY see a second
  // expression, and Postgres then rejects the query.
  const bucketExpr = hourly
    ? sql<string>`to_char(${clickEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24":00:00.000Z"')`
    : sql<string>`to_char(${clickEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  const rawSeries = await db.select({
    bucket: bucketExpr,
    count: countAll,
  }).from(clickEvents).where(and(
    scope,
    gte(clickEvents.createdAt, new Date(start)),
    trafficWhere,
  )).groupBy(bucketExpr);

  const seriesMap = new Map<string, number>(rawSeries.map(r => [String(r.bucket), Number(r.count)]));
  const series = zeroFillSeries(start, now, bucketMs, hourly, seriesMap);

  const referrers = await db.select({
    label: clickEvents.referrerHost,
    count: countAll,
  }).from(clickEvents).where(and(scope, inWindow, trafficWhere)).groupBy(clickEvents.referrerHost).orderBy(sql`count(*) desc`).limit(10);

  const countries = await db.select({
    label: clickEvents.country,
    count: countAll,
  }).from(clickEvents).where(and(
    scope,
    sql`${clickEvents.country} IS NOT NULL`,
    inWindow,
    trafficWhere,
  )).groupBy(clickEvents.country).orderBy(sql`count(*) desc`).limit(10);

  const unknownCountryRows = await db.select({ n: countAll }).from(clickEvents).where(and(
    scope,
    sql`${clickEvents.country} IS NULL`,
    inWindow,
    trafficWhere,
  ));
  const unknownCountryCount = unknownCountryRows[0]?.n ?? 0;

  const devices = await breakdown(db, scope, clickEvents.deviceCategory, inWindow, trafficWhere);
  const browsers = await breakdown(db, scope, clickEvents.browserCategory, inWindow, trafficWhere);

  return {
    periodClicks,
    series,
    topReferrers: referrers.map(r => ({ label: r.label ?? 'direct', count: r.count })),
    topCountries: countries.map(r => ({ label: r.label!, count: r.count })),
    unknownCountryCount,
    devices,
    browsers,
  };
}

async function breakdown(
  db: Awaited<ReturnType<typeof getDb>>,
  scope: SQL,
  column: typeof clickEvents.deviceCategory | typeof clickEvents.browserCategory,
  inWindow: SQL,
  trafficWhere: SQL,
) {
  const rows = await db.select({ label: column, count: countAll }).from(clickEvents).where(and(scope, inWindow, trafficWhere)).groupBy(column);
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows.map(r => ({
    label: r.label as string,
    count: r.count,
    percentage: Math.round((r.count / total) * 1000) / 10,
  }));
}

function windowFilter(windowStart: number | null): SQL {
  return windowStart ? gte(clickEvents.createdAt, new Date(windowStart)) : sql`1=1`;
}

function periodStart(period: Period, now: number): number | null {
  if (period === '24h')
    return now - 24 * 3600_000;
  if (period === '7d')
    return now - 7 * 86_400_000;
  if (period === '30d')
    return now - 30 * 86_400_000;
  return null;
}

function zeroFillSeries(
  startMs: number,
  endMs: number,
  bucketMs: number,
  hourly: boolean,
  counts: Map<string, number>,
) {
  const out: { bucket: string; count: number }[] = [];
  let t = hourly
    ? Math.floor(startMs / 3600_000) * 3600_000
    : Math.floor(startMs / 86_400_000) * 86_400_000;

  while (t <= endMs) {
    const bucket = hourly
      ? `${new Date(t).toISOString().slice(0, 13)}:00:00.000Z`
      : new Date(t).toISOString().slice(0, 10);
    out.push({ bucket, count: counts.get(bucket) ?? 0 });
    t += bucketMs;
  }
  return out;
}
