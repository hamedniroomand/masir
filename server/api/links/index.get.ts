import type { ShortUrlWorkspace } from '#server/utils/link-repo';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { aliasesForLinks, linkToDto, listLinks, tagNamesByLinkIds } from '#server/utils/link-repo';
import { validateDestination } from '#server/utils/url';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const user = await requireUser(event);
  const workspace = event.context.workspace as ShortUrlWorkspace;
  const query = getQuery(event);
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  let perPage = Number(query.perPage ?? 20) || 20;
  perPage = Math.min(100, Math.max(1, perPage));
  const sort = query.sort === 'clicks' ? 'clicks' : 'createdAt';
  const status = query.status;
  const statusFilter = status === 'active' || status === 'disabled' || status === 'expired'
    || status === 'limit_reached' || status === 'scheduled'
    ? status
    : undefined;

  const rawTags = query.tags;
  const tagFilters = Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === 'string')
    : typeof rawTags === 'string'
      ? [rawTags]
      : [];

  // The same normalisation the create route applies, so a stored URL and the
  // one the form sends compare equal.
  const config = useRuntimeConfig();
  const rawDestination = typeof query.destination === 'string' ? query.destination : '';
  const destination = rawDestination ? validateDestination(rawDestination, config.allowPrivateDestinations) : null;

  const campaignId = typeof query.campaignId === 'string' && query.campaignId
    ? query.campaignId
    : undefined;

  let createdBy: string | undefined;
  if (typeof query.createdBy === 'string' && query.createdBy) {
    createdBy = query.createdBy === 'me' ? user.id : query.createdBy;
  }

  // Default false. Only an explicit true asks for archived or trashed rows.
  const archived = query.archived === 'true' || query.archived === true;
  const trashed = query.trashed === 'true' || query.trashed === true;
  const needsReview = query.needsReview === 'true' || query.needsReview === true;

  const { items, total } = await listLinks(workspaceId, {
    q: typeof query.q === 'string' ? query.q : undefined,
    destination: destination?.ok ? destination.url : undefined,
    status: statusFilter,
    tags: tagFilters.length ? tagFilters : undefined,
    campaignId,
    createdBy,
    archived,
    trashed: trashed || undefined,
    needsReview: needsReview || undefined,
    page,
    perPage,
    sort,
  });

  const tagMap = await tagNamesByLinkIds(items.map(i => i.id));
  const aliasMap = await aliasesForLinks(items.map(i => i.id));

  return {
    items: items.map(link => linkToDto(link, workspace, tagMap.get(link.id) ?? [], aliasMap.get(link.id) ?? [])),
    total,
    page,
    perPage,
  };
});
