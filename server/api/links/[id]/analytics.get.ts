import { getLinkAnalytics } from '../../../utils/analytics';
import { requireUser } from '../../../utils/auth';
import { findLinkByIdForUser } from '../../../utils/link-repo';

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

  const data = await getLinkAnalytics(link.id, period);
  return data;
});
