import { getWorkspaceAnalytics } from '#server/utils/analytics';
import { readAnalyticsOptions } from '#server/utils/analytics-query';
import { requireWorkspaceMember } from '#server/utils/auth';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'analytics.read');
  const options = readAnalyticsOptions(event);
  const analytics = await getWorkspaceAnalytics(workspaceId, options);
  if (!analytics)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  return analytics;
});
