import { getCampaignAnalytics } from '#server/utils/analytics';
import {
  buildAnalyticsCsvRows,
  compareMetrics,
  labelCountBreakdowns,
  metaMetrics,
  topLinkRows,
} from '#server/utils/analytics-csv';
import { readAnalyticsOptions } from '#server/utils/analytics-query';
import { requireWorkspaceMember } from '#server/utils/auth';
import { findCampaignForWorkspace } from '#server/utils/campaign-repo';
import { csvResponse } from '#server/utils/csv-response';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const campaign = await findCampaignForWorkspace(id, workspaceId);
  if (!campaign)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const attributionRaw = getQuery(event).attribution;
  const attribution = attributionRaw === 'recorded' ? 'recorded' : 'current';
  const options = readAnalyticsOptions(event);

  const data = await getCampaignAnalytics(campaign.id, workspaceId, options, attribution);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const metrics = [
    { key: 'periodClicks', value: data.periodClicks },
    { key: 'totalClicks', value: data.totalClicks },
    { key: 'linkCount', value: data.linkCount },
    { key: 'uniqueVisitors', value: data.uniqueVisitors },
    { key: 'botRequests', value: data.botRequests },
    ...metaMetrics(data.meta as Record<string, unknown> | undefined),
    ...compareMetrics(data),
  ];

  return csvResponse(event, 'campaign-analytics.csv', buildAnalyticsCsvRows({
    metrics,
    series: data.series,
    breakdowns: labelCountBreakdowns({
      source: data.bySource,
      medium: data.byMedium,
      referrer: data.topReferrers,
      country: data.topCountries,
      device: data.devices,
      browser: data.browsers,
    }),
    topLinks: topLinkRows(data.topLinks),
  }));
});
