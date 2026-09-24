import { getWorkspaceAnalytics } from '#server/utils/analytics';
import {
  buildAnalyticsCsvRows,
  compareMetrics,
  metaMetrics,
} from '#server/utils/analytics-csv';
import { readAnalyticsOptions } from '#server/utils/analytics-query';
import { requireWorkspaceMember } from '#server/utils/auth';
import { csvResponse } from '#server/utils/csv-response';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'analytics.read');
  const options = readAnalyticsOptions(event);
  const analytics = await getWorkspaceAnalytics(workspaceId, options);
  if (!analytics)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const metrics = [
    {
      key: 'clicks',
      definitionKey: 'periodClicks',
      value: analytics.clicks,
    },
    { key: 'uniqueVisitors', value: analytics.uniqueVisitors },
    { key: 'botRequests', value: analytics.botRequests },
    ...metaMetrics(analytics.meta as Record<string, unknown> | undefined),
    ...compareMetrics(analytics),
  ];

  return csvResponse(event, 'workspace-analytics.csv', buildAnalyticsCsvRows({
    metrics,
    series: analytics.timeline,
  }));
});
