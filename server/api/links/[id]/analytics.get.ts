import { getLinkAnalytics } from '#server/utils/analytics';
import { requireWorkspaceMember } from '#server/utils/auth';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const periodRaw = getQuery(event).period;
  const period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';

  const trafficRaw = getQuery(event).traffic;
  const traffic = trafficRaw === 'bot' || trafficRaw === 'all' ? trafficRaw : 'human';

  // getLinkAnalytics reads the link itself and scopes it to the workspace, so a
  // second read here would only repeat that statement.
  const data = await getLinkAnalytics(id, workspaceId, period, traffic);
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  return data;
});
