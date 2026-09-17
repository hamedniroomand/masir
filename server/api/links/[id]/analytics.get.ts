import { getLinkAnalytics } from '#server/utils/analytics';
import { requireWorkspaceMember } from '#server/utils/auth';
import { findLinkById } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const periodRaw = getQuery(event).period;
  const period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';

  const trafficRaw = getQuery(event).traffic;
  const traffic = trafficRaw === 'bot' || trafficRaw === 'all' ? trafficRaw : 'human';

  const data = await getLinkAnalytics(link.id, workspaceId, period, traffic);
  return data;
});
