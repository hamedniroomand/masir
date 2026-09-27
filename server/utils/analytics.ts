import type { SQL } from 'drizzle-orm';
import type { RequestMeta } from '#server/utils/request-meta';
import type { Period } from '#shared/analytics-range';
import type { OutcomeLabel } from '#shared/codes';
import * as Sentry from '@sentry/nuxt';
import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { oldestPartitionStart } from '#server/database/migrate';
import { campaigns, clickEvents, hosts, links, workspaces } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { hostId } from '#server/utils/host-repo';
import { getSignals, setSignal } from '#server/utils/service-signals';
import { changeFrom, previousWindow } from '#shared/analytics-range';
import { BOT_CATEGORY, BROWSER, browserLabel, DEVICE, deviceLabel, OUTCOME } from '#shared/codes';
import { sentryEnabled } from '#shared/sentry';

// Postgres returns bigint as a string. The cast keeps every count a number.
const countAll = sql<number>`count(*)::int`;

let hasRecordedEventWriteFailure = false;
let eventWriteFailureCount = 0;

export function getEventWriteFailureCount() {
  return eventWriteFailureCount;
}

export async function reportEventWriteFailure(error: unknown) {
  eventWriteFailureCount++;
  hasRecordedEventWriteFailure = true;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[event-write-failure] ${message}`, error);
  if (sentryEnabled())
    Sentry.captureException(error);
  await setSignal('event_write', 'failed', { message, at: new Date().toISOString() });
}

export type EventAttribution = {
  campaignId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
};

function truncate(value: string | null | undefined, max = 120): string | null {
  if (!value)
    return null;
  return value.slice(0, max);
}

// One insert, no transaction. consumeVisit already raised the counter inside
// its own guard, so there is nothing here to keep in step with it.
export async function recordEvent(
  workspaceId: string,
  linkId: string,
  meta: RequestMeta,
  outcome: OutcomeLabel,
  visitorHash: bigint | null = null,
  attribution?: EventAttribution | null,
) {
  const db = await getDb();
  const referrerHost = await hostId(meta.referrerHost);
  await db.insert(clickEvents).values({
    workspaceId,
    linkId,
    visitorHash,
    referrerHost,
    outcome: OUTCOME[outcome],
    device: DEVICE[meta.deviceCategory],
    browser: BROWSER[meta.browserCategory],
    botCategory: meta.botCategory == null ? null : BOT_CATEGORY[meta.botCategory],
    country: meta.country,
    isBot: meta.isBot,
    campaignId: attribution?.campaignId ?? null,
    attributionVersion: attribution ? 1 : null,
    utmSource: truncate(attribution?.utmSource),
    utmMedium: truncate(attribution?.utmMedium),
    utmCampaign: truncate(attribution?.utmCampaign),
    utmContent: truncate(attribution?.utmContent),
  });

  if (hasRecordedEventWriteFailure) {
    hasRecordedEventWriteFailure = false;
    await setSignal('event_write', 'ok', { recoveredAt: new Date().toISOString() });
  }
}

type TrafficClass = 'human' | 'bot' | 'all';

type LabelCount = { label: string; count: number };

const humanFilter = eq(clickEvents.outcome, OUTCOME.redirect_success);

function trafficFilter(traffic: TrafficClass): SQL {
  if (traffic === 'human')
    return humanFilter;
  if (traffic === 'bot')
    return eq(clickEvents.outcome, OUTCOME.bot_request);
  return sql`1=1`;
}

export type AnalyticsReadOptions = {
  mode: 'period' | 'range';
  period?: Period | null;
  fromMs: number | null;
  toMs: number;
  fromDate?: string;
  toDate?: string;
  compare?: boolean;
  traffic?: TrafficClass;
};

type CompareScalars = {
  clicks: number;
  uniqueVisitors: number;
  botRequests: number;
};

async function reportSignals(): Promise<Array<'event_write_failed'>> {
  const signals = await getSignals();
  const failed = signals.find(row => row.key === 'event_write' && row.state === 'failed');
  return failed ? ['event_write_failed'] : [];
}

async function scalarCounts(scope: SQL, fromMs: number | null, toMs: number | null, traffic: TrafficClass): Promise<CompareScalars> {
  const db = await getDb();
  const trafficWhere = trafficFilter(traffic);
  const [row] = await db.select({
    clicks: sql<number>`count(*) filter (where ${trafficWhere})::int`,
    botRequests: sql<number>`count(*) filter (where ${clickEvents.outcome} = ${OUTCOME.bot_request})::int`,
    uniqueVisitors: sql<number>`count(distinct ${clickEvents.visitorHash}) filter (where ${clickEvents.outcome} = ${OUTCOME.redirect_success})::int`,
  }).from(clickEvents).where(and(scope, rangeFilter(fromMs, toMs)));
  return {
    clicks: Number(row?.clicks ?? 0),
    uniqueVisitors: Number(row?.uniqueVisitors ?? 0),
    botRequests: Number(row?.botRequests ?? 0),
  };
}

async function buildRangeMeta(options: AnalyticsReadOptions, extras: Record<string, unknown> = {}) {
  const earliest = await oldestPartitionStart(await getDb());
  const earliestEventAt = earliest ? earliest.toISOString() : null;
  const signals = await reportSignals();
  const meta: Record<string, unknown> = {
    timezone: 'UTC',
    traffic: options.traffic ?? 'human',
    earliestEventAt,
    signals,
    ...extras,
  };
  if (options.mode === 'range') {
    meta.from = options.fromDate;
    meta.to = options.toDate;
    if (earliest && options.fromMs != null && options.fromMs < earliest.getTime())
      meta.warning = 'This range starts before the oldest retained events.';
  }
  else {
    meta.period = options.period;
  }
  return meta;
}

export async function getLinkAnalytics(linkId: string, workspaceId: string, options: AnalyticsReadOptions) {
  const db = await getDb();
  const linkRows = await db.select().from(links).where(and(
    eq(links.id, linkId),
    eq(links.workspaceId, workspaceId),
    isNull(links.deletedAt),
  )).limit(1);
  const link = linkRows[0];
  if (!link)
    return null;

  const remainingVisits = link.maximumVisits != null
    ? Math.max(0, link.maximumVisits - link.clickCount)
    : null;

  const traffic = options.traffic ?? 'human';
  const scope = eq(clickEvents.linkId, linkId);
  const analytics = await buildAnalytics(scope, options, link.createdAt.getTime(), traffic);

  const compare = await loadComparison(scope, options, traffic, analytics.periodClicks);

  if (options.mode === 'period') {
    return {
      totalClicks: link.clickCount,
      lifetimeClicks: link.clickCount,
      remainingVisits,
      maximumVisits: link.maximumVisits,
      successfulVisitCount: link.clickCount,
      usedVisits: link.clickCount,
      ...analytics,
      ...compare,
      meta: {
        timezone: 'UTC',
        period: options.period,
        traffic,
      },
    };
  }

  const meta = await buildRangeMeta(options, { traffic });
  return {
    totalClicks: link.clickCount,
    lifetimeClicks: link.clickCount,
    remainingVisits,
    maximumVisits: link.maximumVisits,
    successfulVisitCount: link.clickCount,
    usedVisits: link.clickCount,
    ...analytics,
    ...compare,
    meta,
  };
}

export type CampaignAttributionMode = 'current' | 'recorded';

export async function getCampaignAnalytics(
  campaignId: string,
  workspaceId: string,
  options: AnalyticsReadOptions,
  attribution: CampaignAttributionMode = 'current',
) {
  const db = await getDb();
  const campaignRows = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId))).limit(1);
  const campaign = campaignRows[0];
  if (!campaign)
    return null;

  // Deleted links stay in this read. Their clicks belong to the campaign total
  // and to the charts, and only the lists below drop them.
  const linkRows = await db.select({
    id: links.id,
    slug: links.slug,
    title: links.title,
    utmSource: links.utmSource,
    utmContent: links.utmContent,
    clickCount: links.clickCount,
    deletedAt: links.deletedAt,
  }).from(links).where(and(eq(links.campaignId, campaignId), eq(links.workspaceId, workspaceId)));
  const liveRows = linkRows.filter(row => row.deletedAt == null);
  const period = options.period ?? '7d';
  const inWindow = rangeFilter(
    options.mode === 'range' ? options.fromMs : options.fromMs,
    options.mode === 'range' ? options.toMs : null,
  );

  if (attribution === 'recorded') {
    const scope = and(eq(clickEvents.workspaceId, workspaceId), eq(clickEvents.campaignId, campaignId)) ?? sql`1=1`;

    const [totalRow] = await db.select({ count: countAll }).from(clickEvents).where(and(scope, humanFilter));
    const totalClicks = Number(totalRow?.count ?? 0);

    const [legacyRow] = await db.select({ count: countAll }).from(clickEvents).where(and(scope, inWindow, humanFilter, isNull(clickEvents.attributionVersion)));
    const legacyCount = Number(legacyRow?.count ?? 0);

    const sourceRows = await db.select({
      label: clickEvents.utmSource,
      count: countAll,
    })
      .from(clickEvents)
      .where(and(scope, inWindow, humanFilter))
      .groupBy(clickEvents.utmSource)
      .orderBy(desc(countAll));

    const mediumRows = await db.select({
      label: clickEvents.utmMedium,
      count: countAll,
    })
      .from(clickEvents)
      .where(and(scope, inWindow, humanFilter))
      .groupBy(clickEvents.utmMedium)
      .orderBy(desc(countAll));

    const linkClickRows = await db.select({
      id: clickEvents.linkId,
      count: countAll,
    })
      .from(clickEvents)
      .where(and(scope, inWindow, humanFilter))
      .groupBy(clickEvents.linkId);
    const periodByLink = new Map(linkClickRows.map(row => [row.id, Number(row.count)]));

    const bySource = sourceRows.map(row => ({ label: row.label ?? 'not set', count: Number(row.count) }));
    const byMedium = mediumRows.map(row => ({ label: row.label ?? 'not set', count: Number(row.count) }));
    const analytics = await buildAnalytics(scope, options, campaign.createdAt.getTime(), 'human');

    let previousBreakdown: { bySource?: LabelCount[]; byMedium?: LabelCount[] } | undefined;
    if (options.compare && options.fromMs != null) {
      const prev = previousWindow(options.fromMs, options.toMs);
      const prevFilter = rangeFilter(prev.fromMs, prev.toMs);
      const prevSourceRows = await db.select({
        label: clickEvents.utmSource,
        count: countAll,
      })
        .from(clickEvents)
        .where(and(scope, prevFilter, humanFilter))
        .groupBy(clickEvents.utmSource)
        .orderBy(desc(countAll));
      const prevMediumRows = await db.select({
        label: clickEvents.utmMedium,
        count: countAll,
      })
        .from(clickEvents)
        .where(and(scope, prevFilter, humanFilter))
        .groupBy(clickEvents.utmMedium)
        .orderBy(desc(countAll));
      previousBreakdown = {
        bySource: prevSourceRows.map(row => ({ label: row.label ?? 'not set', count: Number(row.count) })),
        byMedium: prevMediumRows.map(row => ({ label: row.label ?? 'not set', count: Number(row.count) })),
      };
    }

    const compare = await loadComparison(scope, options, 'human', analytics.periodClicks, previousBreakdown);
    const meta = options.mode === 'period'
      ? { timezone: 'UTC', period, traffic: 'human' as const, attribution, legacyCount }
      : { ...(await buildRangeMeta(options, { traffic: 'human', attribution, legacyCount })) };

    return {
      totalClicks,
      linkCount: liveRows.length,
      bySource,
      byMedium,
      topLinks: liveRows
        .map(row => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          utmSource: row.utmSource,
          utmContent: row.utmContent,
          totalClicks: row.clickCount,
          periodClicks: periodByLink.get(row.id) ?? 0,
        }))
        .sort((a, b) => b.periodClicks - a.periodClicks || b.totalClicks - a.totalClicks),
      ...analytics,
      ...compare,
      meta,
    };
  }

  if (!linkRows.length) {
    const emptyAnalytics = await buildAnalytics(sql`1=0`, options, campaign.createdAt.getTime(), 'human');
    const meta = options.mode === 'period'
      ? { timezone: 'UTC', period, traffic: 'human' as const, attribution, legacyCount: 0 }
      : { ...(await buildRangeMeta(options, { traffic: 'human', attribution, legacyCount: 0 })) };
    return {
      totalClicks: 0,
      linkCount: 0,
      bySource: [],
      byMedium: [],
      topLinks: [],
      ...emptyAnalytics,
      meta,
    };
  }

  const scope = inArray(clickEvents.linkId, linkRows.map(row => row.id));

  const [legacyRow] = await db.select({ count: countAll }).from(clickEvents).where(and(scope, inWindow, humanFilter, isNull(clickEvents.attributionVersion)));
  const legacyCount = Number(legacyRow?.count ?? 0);

  const sourceRows = await db.select({
    label: links.utmSource,
    count: countAll,
  }).from(clickEvents).innerJoin(links, eq(clickEvents.linkId, links.id)).where(and(scope, inWindow, humanFilter)).groupBy(links.utmSource).orderBy(desc(countAll));

  const linkClickRows = await db.select({
    id: clickEvents.linkId,
    count: countAll,
  }).from(clickEvents).where(and(scope, inWindow, humanFilter)).groupBy(clickEvents.linkId);
  const periodByLink = new Map(linkClickRows.map(row => [row.id, Number(row.count)]));

  const analytics = await buildAnalytics(scope, options, campaign.createdAt.getTime(), 'human');
  const compare = await loadComparison(scope, options, 'human', analytics.periodClicks);

  const byMedium = analytics.periodClicks > 0 && campaign.utmMedium
    ? [{ label: campaign.utmMedium, count: analytics.periodClicks }]
    : [];

  const meta = options.mode === 'period'
    ? { timezone: 'UTC', period, traffic: 'human' as const, attribution, legacyCount }
    : { ...(await buildRangeMeta(options, { traffic: 'human', attribution, legacyCount })) };

  return {
    totalClicks: linkRows.reduce((sum, row) => sum + row.clickCount, 0),
    linkCount: liveRows.length,
    bySource: sourceRows.map(row => ({ label: row.label ?? 'not set', count: Number(row.count) })),
    byMedium,
    topLinks: liveRows
      .map(row => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        utmSource: row.utmSource,
        utmContent: row.utmContent,
        totalClicks: row.clickCount,
        periodClicks: periodByLink.get(row.id) ?? 0,
      }))
      .sort((a, b) => b.periodClicks - a.periodClicks || b.totalClicks - a.totalClicks),
    ...analytics,
    ...compare,
    meta,
  };
}

const ATTENTION_ROWS = 10;
const TOP_LINKS = 5;
const EXPIRING_DAYS = 7;
const NEAR_CAP_RATIO = 0.8;
const STOPPED_WINDOW_MS = 7 * 86_400_000;

const linkSummary = {
  id: links.id,
  slug: links.slug,
  title: links.title,
  clickCount: links.clickCount,
  maximumVisits: links.maximumVisits,
  expiresAt: links.expiresAt,
};

// One page that answers "how is the workspace doing" and "what needs
// attention". Totals and the timeline reuse buildAnalytics with the workspace
// as the scope, so there is no second implementation of either.
export async function getWorkspaceAnalytics(workspaceId: string, options: AnalyticsReadOptions) {
  const db = await getDb();
  const workspaceRows = await db.select({ createdAt: workspaces.createdAt }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  const createdAt = workspaceRows[0]?.createdAt;
  if (!createdAt)
    return null;

  const scope = eq(clickEvents.workspaceId, workspaceId);
  const analytics = await buildAnalytics(scope, options, createdAt.getTime(), 'human');
  const compare = await loadComparison(scope, options, 'human', analytics.periodClicks);

  const inWindow = rangeFilter(
    options.mode === 'range' ? options.fromMs : options.fromMs,
    options.mode === 'range' ? options.toMs : null,
  );
  const topRows = await db.select({
    id: clickEvents.linkId,
    slug: links.slug,
    title: links.title,
    clicks: countAll,
  })
    .from(clickEvents)
    .innerJoin(links, eq(clickEvents.linkId, links.id))
    .where(and(scope, inWindow, humanFilter, isNull(links.deletedAt)))
    .groupBy(clickEvents.linkId, links.slug, links.title)
    .orderBy(desc(countAll))
    .limit(TOP_LINKS);

  const now = new Date();
  const live = and(eq(links.workspaceId, workspaceId), isNull(links.deletedAt));

  const expiringSoon = await db.select(linkSummary).from(links).where(and(
    live,
    eq(links.isEnabled, true),
    gte(links.expiresAt, now),
    lte(links.expiresAt, new Date(now.getTime() + EXPIRING_DAYS * 86_400_000)),
  )).orderBy(links.expiresAt).limit(ATTENTION_ROWS);

  const nearCap = await db.select(linkSummary).from(links).where(and(
    live,
    eq(links.isEnabled, true),
    sql`${links.maximumVisits} is not null`,
    sql`${links.clickCount} >= ceil(${NEAR_CAP_RATIO} * ${links.maximumVisits})`,
    sql`${links.clickCount} < ${links.maximumVisits}`,
  )).orderBy(desc(links.clickCount)).limit(ATTENTION_ROWS);

  // Expiry passing and the last visit never touch updated_at, so the window
  // reads expires_at for an expired link. A used-up cap has no timestamp, so
  // every link at its cap shows until somebody raises or removes it.
  const stopped = await db.select(linkSummary).from(links).where(and(
    live,
    eq(links.isEnabled, true),
    sql`(
      (${links.expiresAt} > ${new Date(now.getTime() - STOPPED_WINDOW_MS)} and ${links.expiresAt} <= ${now})
      or (${links.maximumVisits} is not null and ${links.clickCount} >= ${links.maximumVisits})
    )`,
  )).orderBy(desc(sql`coalesce(${links.expiresAt}, ${links.updatedAt})`)).limit(ATTENTION_ROWS);

  const meta = options.mode === 'period'
    ? { timezone: 'UTC', period: options.period, traffic: 'human' as const }
    : { ...(await buildRangeMeta(options, { traffic: 'human' })) };

  return {
    clicks: analytics.periodClicks,
    uniqueVisitors: analytics.uniqueVisitors,
    botRequests: analytics.botRequests,
    timeline: analytics.series,
    topLinks: topRows.map(row => ({ id: row.id, slug: row.slug, title: row.title, clicks: Number(row.clicks) })),
    attention: { expiringSoon, nearCap, stopped },
    ...compare,
    meta,
  };
}

const TOP_ROWS = 10;

function withPercentage(rows: LabelCount[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return rows.map(row => ({
    ...row,
    percentage: Math.round((row.count / total) * 1000) / 10,
  }));
}

function byCountDesc(a: LabelCount, b: LabelCount) {
  return b.count - a.count;
}

async function loadComparison(
  scope: SQL,
  options: AnalyticsReadOptions,
  traffic: TrafficClass,
  currentClicks: number,
  extra?: { bySource?: LabelCount[]; byMedium?: LabelCount[] },
) {
  if (!options.compare || options.fromMs == null)
    return {};
  const prev = previousWindow(options.fromMs, options.toMs);
  const previous = await scalarCounts(scope, prev.fromMs, prev.toMs, traffic);
  return {
    previous: { ...previous, ...extra },
    change: changeFrom(currentClicks, previous.clicks),
  };
}

async function buildAnalytics(scope: SQL, options: AnalyticsReadOptions, createdAtMs: number, traffic: TrafficClass) {
  const db = await getDb();
  const now = Date.now();
  const fromMs = options.fromMs;
  const toMs = options.mode === 'range' ? options.toMs : null;
  const hourly = options.period === '24h'
    || (options.mode === 'range' && options.fromMs != null && (options.toMs - options.fromMs) <= 24 * 3600_000);
  const inWindow = rangeFilter(fromMs, toMs);
  const trafficWhere = trafficFilter(traffic);

  // One statement for every scalar. A filtered count reads the rows the others
  // read, so four queries would scan the same range four times.
  const scalarRows = await db.select({
    periodClicks: sql<number>`count(*) filter (where ${trafficWhere})::int`,
    botRequests: sql<number>`count(*) filter (where ${clickEvents.outcome} = ${OUTCOME.bot_request})::int`,
    uniqueVisitors: sql<number>`count(distinct ${clickEvents.visitorHash}) filter (where ${clickEvents.outcome} = ${OUTCOME.redirect_success})::int`,
    unknownCountryCount: sql<number>`count(*) filter (where ${clickEvents.country} is null and ${trafficWhere})::int`,
  }).from(clickEvents).where(and(scope, inWindow));
  const scalars = scalarRows[0] ?? {
    periodClicks: 0,
    botRequests: 0,
    uniqueVisitors: 0,
    unknownCountryCount: 0,
  };

  const bucketMs = hourly ? 3600_000 : 86_400_000;
  const start = fromMs ?? createdAtMs;
  const endMs = toMs ?? now;

  // The buckets must stay UTC. zeroFillSeries builds its labels from UTC too.
  // The format stays a literal. A bound parameter makes GROUP BY see a second
  // expression, and Postgres then rejects the query.
  const bucketExpr = hourly
    ? sql<string>`to_char(${clickEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24":00:00.000Z"')`
    : sql<string>`to_char(${clickEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  // ponytail: a raw scan of every event row in the window. The upgrade path is
  // link_daily_stats, which the schema already carries, filled by an hourly
  // rollup job. Do that when one link passes a few million events.
  const rawSeries = await db.select({
    bucket: bucketExpr,
    count: countAll,
  }).from(clickEvents).where(and(
    scope,
    rangeFilter(start, toMs),
    trafficWhere,
  )).groupBy(bucketExpr);

  const seriesMap = new Map<string, number>(rawSeries.map(row => [String(row.bucket), Number(row.count)]));
  const series = zeroFillSeries(start, endMs, bucketMs, hourly, seriesMap);

  // One statement for four breakdowns. grouping() names the set a row came
  // from, because a null in a dimension column means both "no value" and
  // "another set".
  const breakdownRows = await db.select({
    isDevice: sql<number>`grouping(${clickEvents.device})`,
    isBrowser: sql<number>`grouping(${clickEvents.browser})`,
    isCountry: sql<number>`grouping(${clickEvents.country})`,
    isReferrer: sql<number>`grouping(${hosts.host})`,
    device: clickEvents.device,
    browser: clickEvents.browser,
    country: clickEvents.country,
    host: hosts.host,
    count: countAll,
  })
    .from(clickEvents)
    .leftJoin(hosts, eq(clickEvents.referrerHost, hosts.id))
    .where(and(scope, inWindow, trafficWhere))
    .groupBy(sql`grouping sets ((${clickEvents.device}), (${clickEvents.browser}), (${clickEvents.country}), (${hosts.host}))`);

  const devices: LabelCount[] = [];
  const browsers: LabelCount[] = [];
  const countries: LabelCount[] = [];
  const referrers: LabelCount[] = [];

  for (const row of breakdownRows) {
    const count = Number(row.count);
    if (Number(row.isDevice) === 0)
      devices.push({ label: deviceLabel(row.device) ?? 'other', count });
    else if (Number(row.isBrowser) === 0)
      browsers.push({ label: browserLabel(row.browser) ?? 'other', count });
    else if (Number(row.isCountry) === 0)
      countries.push({ label: row.country ?? 'unknown', count });
    else
      referrers.push({ label: row.host ?? 'direct', count });
  }

  return {
    ...scalars,
    series,
    topReferrers: referrers.sort(byCountDesc).slice(0, TOP_ROWS),
    topCountries: countries.filter(row => row.label !== 'unknown').sort(byCountDesc).slice(0, TOP_ROWS),
    devices: withPercentage(devices),
    browsers: withPercentage(browsers),
  };
}

function rangeFilter(fromMs: number | null, toMs: number | null = null): SQL {
  if (fromMs != null && toMs != null)
    return and(gte(clickEvents.createdAt, new Date(fromMs)), lt(clickEvents.createdAt, new Date(toMs))) ?? sql`1=1`;
  if (fromMs != null)
    return gte(clickEvents.createdAt, new Date(fromMs));
  if (toMs != null)
    return lt(clickEvents.createdAt, new Date(toMs));
  return sql`1=1`;
}

function zeroFillSeries(
  startMs: number,
  endMs: number,
  bucketMs: number,
  hourly: boolean,
  counts: Map<string, number>,
) {
  const out: { bucket: string; count: number }[] = [];
  let cursor = hourly
    ? Math.floor(startMs / 3600_000) * 3600_000
    : Math.floor(startMs / 86_400_000) * 86_400_000;

  while (cursor <= endMs) {
    const bucket = hourly
      ? `${new Date(cursor).toISOString().slice(0, 13)}:00:00.000Z`
      : new Date(cursor).toISOString().slice(0, 10);
    out.push({ bucket, count: counts.get(bucket) ?? 0 });
    cursor += bucketMs;
  }
  return out;
}
