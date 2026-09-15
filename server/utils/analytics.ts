import type { SQL } from 'drizzle-orm';
import type { RequestMeta } from '#server/utils/request-meta';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { campaigns, clickEvents, links } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

const countAll = sql<number>`count(*)`;

export async function recordClick(linkId: string, meta: RequestMeta) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(clickEvents).values({
      id: newId(),
      linkId,
      createdAt: new Date(),
      referrerHost: meta.referrerHost,
      country: meta.country,
      deviceCategory: meta.deviceCategory,
      browserCategory: meta.browserCategory,
    });
    await tx.update(links)
      .set({ clickCount: sql`${links.clickCount} + 1` })
      .where(eq(links.id, linkId));
  });
}

type Period = '24h' | '7d' | '30d' | 'all';

export async function getLinkAnalytics(linkId: string, period: Period) {
  const db = await getDb();
  const linkRows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  const link = linkRows[0];
  if (!link)
    return null;

  return {
    totalClicks: link.clickCount,
    ...await buildAnalytics(eq(clickEvents.linkId, linkId), period, link.createdAt.getTime()),
  };
}

export async function getCampaignAnalytics(campaignId: string, period: Period) {
  const db = await getDb();
  const campaignRows = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
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
  }).from(links).where(eq(links.campaignId, campaignId));

  if (!linkRows.length) {
    return {
      totalClicks: 0,
      linkCount: 0,
      bySource: [],
      topLinks: [],
      ...await buildAnalytics(sql`1=0`, period, campaign.createdAt.getTime()),
    };
  }

  const scope = inArray(clickEvents.linkId, linkRows.map(r => r.id));
  const windowStart = periodStart(period, Date.now());

  const sourceRows = await db.select({
    label: links.utmSource,
    count: countAll,
  }).from(clickEvents).innerJoin(links, eq(clickEvents.linkId, links.id)).where(and(scope, windowFilter(windowStart))).groupBy(links.utmSource).orderBy(desc(countAll));

  const linkClickRows = await db.select({
    id: clickEvents.linkId,
    count: countAll,
  }).from(clickEvents).where(and(scope, windowFilter(windowStart))).groupBy(clickEvents.linkId);
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
    ...await buildAnalytics(scope, period, campaign.createdAt.getTime()),
  };
}

async function buildAnalytics(scope: SQL, period: Period, createdAtMs: number) {
  const db = await getDb();
  const now = Date.now();
  const windowStart = periodStart(period, now);
  const hourly = period === '24h';
  const inWindow = windowFilter(windowStart);

  const periodClicksRows = await db.select({ n: countAll }).from(clickEvents).where(and(scope, inWindow));
  const periodClicks = periodClicksRows[0]?.n ?? 0;

  const bucketFormat = hourly ? '%Y-%m-%dT%H:00:00.000Z' : '%Y-%m-%d';
  const bucketMs = hourly ? 3600_000 : 86_400_000;
  const start = windowStart ?? createdAtMs;

  const rawSeries = await db.select({
    bucket: sql<string>`strftime(${bucketFormat}, ${clickEvents.createdAt} / 1000, 'unixepoch')`,
    count: countAll,
  }).from(clickEvents).where(and(
    scope,
    gte(clickEvents.createdAt, new Date(start)),
  )).groupBy(sql`strftime(${bucketFormat}, ${clickEvents.createdAt} / 1000, 'unixepoch')`);

  const seriesMap = new Map<string, number>(rawSeries.map(r => [String(r.bucket), Number(r.count)]));
  const series = zeroFillSeries(start, now, bucketMs, hourly, seriesMap);

  const referrers = await db.select({
    label: clickEvents.referrerHost,
    count: countAll,
  }).from(clickEvents).where(and(scope, inWindow)).groupBy(clickEvents.referrerHost).orderBy(sql`count(*) desc`).limit(10);

  const countries = await db.select({
    label: clickEvents.country,
    count: countAll,
  }).from(clickEvents).where(and(
    scope,
    sql`${clickEvents.country} IS NOT NULL`,
    inWindow,
  )).groupBy(clickEvents.country).orderBy(sql`count(*) desc`).limit(10);

  const unknownCountryRows = await db.select({ n: countAll }).from(clickEvents).where(and(
    scope,
    sql`${clickEvents.country} IS NULL`,
    inWindow,
  ));
  const unknownCountryCount = unknownCountryRows[0]?.n ?? 0;

  const devices = await breakdown(db, scope, clickEvents.deviceCategory, inWindow);
  const browsers = await breakdown(db, scope, clickEvents.browserCategory, inWindow);

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
) {
  const rows = await db.select({ label: column, count: countAll }).from(clickEvents).where(and(scope, inWindow)).groupBy(column);
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
