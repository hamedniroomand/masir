import { getLinkAnalytics } from '#server/utils/analytics';
import { requireUser } from '#server/utils/auth';
import { findLinkByIdForUser } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkByIdForUser(id, user.id);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const periodRaw = getQuery(event).period;
  const period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';

  const trafficRaw = getQuery(event).traffic;
  const traffic = trafficRaw === 'bot' || trafficRaw === 'all' ? trafficRaw : 'human';

  const data = await getLinkAnalytics(link.id, period, traffic);
  return data;
});
