// @ts-nocheck drizzle query types vs Nuxt auto-imports
import type { RequestMeta } from '#server/utils/request-meta';
import { and, eq, gte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { clickEvents, links } from '#server/database/schema';
import { getDb } from '#server/utils/db';

const countAll = sql<number>`count(*)`;

export async function recordClick(linkId: string, meta: RequestMeta) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(clickEvents).values({
      id: nanoid(),
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

  const now = Date.now();
  const windowStart = periodStart(period, now);
  const hourly = period === '24h';

  const periodClicksRows = windowStart
    ? await db.select({ n: countAll }).from(clickEvents).where(and(
        eq(clickEvents.linkId, linkId),
        gte(clickEvents.createdAt, new Date(windowStart)),
      ))
    : await db.select({ n: countAll }).from(clickEvents).where(eq(clickEvents.linkId, linkId));
  const periodClicks = periodClicksRows[0]?.n ?? 0;

  const bucketFormat = hourly ? '%Y-%m-%dT%H:00:00.000Z' : '%Y-%m-%d';
  const bucketMs = hourly ? 3600_000 : 86_400_000;
  const start = windowStart ?? link.createdAt.getTime();

  const rawSeries = await db.select({
    bucket: sql<string>`strftime(${bucketFormat}, ${clickEvents.createdAt} / 1000, 'unixepoch')`,
    count: countAll,
  }).from(clickEvents).where(and(
    eq(clickEvents.linkId, linkId),
    gte(clickEvents.createdAt, new Date(start)),
  )).groupBy(sql`strftime(${bucketFormat}, ${clickEvents.createdAt} / 1000, 'unixepoch')`);

  const seriesMap = new Map<string, number>(rawSeries.map(r => [String(r.bucket), Number(r.count)]));
  const series = zeroFillSeries(start, now, bucketMs, hourly, seriesMap);

  const referrers = await db.select({
    label: clickEvents.referrerHost,
    count: countAll,
  }).from(clickEvents).where(and(
    eq(clickEvents.linkId, linkId),
    windowStart ? gte(clickEvents.createdAt, new Date(windowStart)) : sql`1=1`,
  )).groupBy(clickEvents.referrerHost).orderBy(sql`count(*) desc`).limit(10);

  const countries = await db.select({
    label: clickEvents.country,
    count: countAll,
  }).from(clickEvents).where(and(
    eq(clickEvents.linkId, linkId),
    sql`${clickEvents.country} IS NOT NULL`,
    windowStart ? gte(clickEvents.createdAt, new Date(windowStart)) : sql`1=1`,
  )).groupBy(clickEvents.country).orderBy(sql`count(*) desc`).limit(10);

  const unknownCountryRows = await db.select({ n: countAll }).from(clickEvents).where(and(
    eq(clickEvents.linkId, linkId),
    sql`${clickEvents.country} IS NULL`,
    windowStart ? gte(clickEvents.createdAt, new Date(windowStart)) : sql`1=1`,
  ));
  const unknownCountryCount = unknownCountryRows[0]?.n ?? 0;

  const devices = await breakdown(db, linkId, clickEvents.deviceCategory, windowStart);
  const browsers = await breakdown(db, linkId, clickEvents.browserCategory, windowStart);

  return {
    totalClicks: link.clickCount,
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
  linkId: string,
  column: typeof clickEvents.deviceCategory | typeof clickEvents.browserCategory,
  windowStart: number | null,
) {
  const rows = await db.select({ label: column, count: countAll }).from(clickEvents).where(and(
    eq(clickEvents.linkId, linkId),
    windowStart ? gte(clickEvents.createdAt, new Date(windowStart)) : sql`1=1`,
  )).groupBy(column);
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows.map(r => ({
    label: r.label as string,
    count: r.count,
    percentage: Math.round((r.count / total) * 1000) / 10,
  }));
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
  let t = Math.floor(startMs / bucketMs) * bucketMs;
  if (hourly)
    t = Math.floor(startMs / 3600_000) * 3600_000;
  else
    t = Math.floor(startMs / 86_400_000) * 86_400_000;

  while (t <= endMs) {
    const bucket = hourly
      ? `${new Date(t).toISOString().slice(0, 13)}:00:00.000Z`
      : new Date(t).toISOString().slice(0, 10);
    out.push({ bucket, count: counts.get(bucket) ?? 0 });
    t += bucketMs;
  }
  return out;
}
