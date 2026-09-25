import type { LinkListQuery, ShortUrlWorkspace } from '#server/utils/link-repo';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { csvResponse } from '#server/utils/csv-response';
import { listLinks, shortUrlFor, tagNamesByLinkIds } from '#server/utils/link-repo';
import { validateDestination } from '#server/utils/url';
import {
  joinImportTags,
  LINK_EXPORT_EXTRA_COLUMNS,
  LINK_IMPORT_COLUMNS,
} from '#shared/link-import';
import { can } from '#shared/permissions';

const PAGE_SIZE = 500;

export default defineEventHandler(async (event) => {
  const { workspaceId, role } = await requireWorkspaceMember(event, 'links.read');
  const user = await requireUser(event);
  const workspace = event.context.workspace as ShortUrlWorkspace;
  const query = getQuery(event);
  const sort = query.sort === 'clicks' ? 'clicks' : 'createdAt';
  const status = query.status;
  const statusFilter: LinkListQuery['status'] = status === 'active' || status === 'disabled' || status === 'expired'
    || status === 'limit_reached' || status === 'scheduled'
    ? status
    : undefined;

  const rawTags = query.tags;
  const tagFilters = Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === 'string')
    : typeof rawTags === 'string'
      ? [rawTags]
      : [];

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

  const archived = query.archived === 'true' || query.archived === true;
  const needsReview = query.needsReview === 'true' || query.needsReview === true;
  const includeNotes = can(role, 'links.manage');

  const listQuery = {
    q: typeof query.q === 'string' ? query.q : undefined,
    destination: destination?.ok ? destination.url : undefined,
    status: statusFilter,
    tags: tagFilters.length ? tagFilters : undefined,
    campaignId,
    createdBy,
    archived,
    needsReview: needsReview || undefined,
    sort: sort as 'createdAt' | 'clicks',
  };

  const items = [];
  let page = 1;
  let total = Infinity;
  while (items.length < total) {
    const batch = await listLinks(workspaceId, { ...listQuery, page, perPage: PAGE_SIZE });
    total = batch.total;
    items.push(...batch.items);
    if (!batch.items.length)
      break;
    page++;
  }

  const tagMap = await tagNamesByLinkIds(items.map(item => item.id));
  const header = [
    ...LINK_IMPORT_COLUMNS,
    ...LINK_EXPORT_EXTRA_COLUMNS,
    ...(includeNotes ? ['notes'] as const : []),
  ];

  const rows: unknown[][] = [header];
  for (const link of items) {
    const tags = tagMap.get(link.id) ?? [];
    const row: unknown[] = [
      link.slug,
      link.destinationUrl,
      link.title ?? '',
      joinImportTags(tags),
      link.utmSource ?? '',
      link.utmMedium ?? '',
      link.utmCampaign ?? '',
      link.utmTerm ?? '',
      link.utmContent ?? '',
      link.startsAt ? link.startsAt.toISOString() : '',
      link.expiresAt ? link.expiresAt.toISOString() : '',
      shortUrlFor(workspace, link.slug),
      link.createdAt.toISOString(),
      link.clickCount,
    ];
    if (includeNotes)
      row.push(link.notes ?? '');
    rows.push(row);
  }

  return csvResponse(event, 'links.csv', rows);
});
