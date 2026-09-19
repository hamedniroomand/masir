import { getWorkspaceAnalytics } from '#server/utils/analytics';
import { requireWorkspaceMember } from '#server/utils/auth';

const PERIODS = ['24h', '7d', '30d', 'all'] as const;

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'analytics.read');
  const raw = getQuery(event).period;
  const period = PERIODS.includes(raw as typeof PERIODS[number]) ? raw as typeof PERIODS[number] : '7d';

  const analytics = await getWorkspaceAnalytics(workspaceId, period);
  if (!analytics)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  return analytics;
});
