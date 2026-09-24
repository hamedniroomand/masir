import { getLinkAnalytics } from '#server/utils/analytics';
import { readAnalyticsOptions } from '#server/utils/analytics-query';
import { requireWorkspaceMember } from '#server/utils/auth';

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
  return data;
});
