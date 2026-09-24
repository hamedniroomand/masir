import { getLinkAnalytics } from '#server/utils/analytics';
import {
  buildAnalyticsCsvRows,
  compareMetrics,
  metaMetrics,
} from '#server/utils/analytics-csv';
import { readAnalyticsOptions } from '#server/utils/analytics-query';
import { requireWorkspaceMember } from '#server/utils/auth';
import { csvResponse } from '#server/utils/csv-response';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const trafficRaw = getQuery(event).traffic;
  const traffic = trafficRaw === 'bot' || trafficRaw === 'all' ? trafficRaw : 'human';
  const options = readAnalyticsOptions(event, { traffic });

  const data = await getLinkAnalytics(id, workspaceId, options);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const metrics = [
    { key: 'periodClicks', value: data.periodClicks },
    { key: 'lifetimeClicks', value: data.lifetimeClicks ?? data.totalClicks },
    { key: 'uniqueVisitors', value: data.uniqueVisitors },
    { key: 'botRequests', value: data.botRequests },
    { key: 'usedVisits', value: data.usedVisits ?? data.successfulVisitCount },
    { key: 'remainingVisits', value: data.remainingVisits },
    { key: 'maximumVisits', value: data.maximumVisits },
    ...metaMetrics(data.meta as Record<string, unknown> | undefined),
    ...compareMetrics(data),
  ];

  return csvResponse(event, 'link-analytics.csv', buildAnalyticsCsvRows({
    metrics,
    series: data.series,
  }));
});
