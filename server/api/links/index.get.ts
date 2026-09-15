import { requireUser } from '../../utils/auth';
import { linkToDto, listLinks } from '../../utils/link-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const query = getQuery(event);
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  let perPage = Number(query.perPage ?? 20) || 20;
  perPage = Math.min(100, Math.max(1, perPage));
  const sort = query.sort === 'clicks' ? 'clicks' : 'createdAt';
  const status = query.status;
  const statusFilter = status === 'active' || status === 'disabled' || status === 'expired'
    ? status
    : undefined;

  const { items, total } = await listLinks(user.id, {
    q: typeof query.q === 'string' ? query.q : undefined,
    status: statusFilter,
    page,
    perPage,
    sort,
  });

  return {
    items: items.map(linkToDto),
    total,
    page,
    perPage,
  };
});
