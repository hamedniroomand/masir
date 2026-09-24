import type { LinkListQuery } from '#server/utils/link-repo';
import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findCampaignForWorkspace } from '#server/utils/campaign-repo';
import { BULK_LINK_CAP, findLinkById, listLinks, updateLink } from '#server/utils/link-repo';
import { addLinkTag, findTagForWorkspace, removeLinkTag } from '#server/utils/tag-repo';
import { validateDestination } from '#server/utils/url';

const statusSchema = v.union([
  v.literal('active'),
  v.literal('disabled'),
  v.literal('expired'),
  v.literal('limit_reached'),
  v.literal('scheduled'),
]);

const filterSchema = v.object({
  q: v.optional(v.string()),
  destination: v.optional(v.string()),
  status: v.optional(statusSchema),
  tags: v.optional(v.array(v.string())),
  campaignId: v.optional(v.string()),
  createdBy: v.optional(v.string()),
  archived: v.optional(v.boolean()),
  sort: v.optional(v.union([v.literal('createdAt'), v.literal('clicks')])),
});

const bodySchema = v.object({
  selection: v.union([
    v.object({ ids: v.pipe(v.array(v.string()), v.minLength(1, 'Select at least one link.')) }),
    v.object({ filter: filterSchema }),
  ]),
  action: v.union([
    v.literal('tag'),
    v.literal('untag'),
    v.literal('assignCampaign'),
    v.literal('archive'),
  ]),
  tagId: v.optional(v.string()),
  campaignId: v.optional(v.nullable(v.string())),
});

type BulkResult = { id: string; status: 'ok' | 'error'; error?: string };

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  if (body.action === 'archive') {
    const reason = 'Archive is not available.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  if ((body.action === 'tag' || body.action === 'untag') && !body.tagId) {
    const reason = 'A tag is required.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  if (body.action === 'assignCampaign' && body.campaignId === undefined) {
    const reason = 'A campaign is required.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  let tag = null;
  if (body.tagId) {
    tag = await findTagForWorkspace(body.tagId, workspaceId);
    if (!tag) {
      const reason = 'Tag not found.';
      throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
    }
  }

  let campaignId: string | null | undefined;
  if (body.action === 'assignCampaign') {
    campaignId = body.campaignId ?? null;
    if (campaignId && !await findCampaignForWorkspace(campaignId, workspaceId)) {
      const reason = 'Campaign not found.';
      throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
    }
  }

  const ids = 'ids' in body.selection
    ? await resolveIds(body.selection.ids, workspaceId)
    : await resolveFilter(body.selection.filter, workspaceId, user.id);

  const results: BulkResult[] = [];
  let affected = 0;

  const selectedTagId = tag?.id;
  const nextCampaignId = campaignId;

  for (const id of ids) {
    try {
      if (body.action === 'tag') {
        if (!selectedTagId) {
          results.push({ id, status: 'error', error: 'A tag is required.' });
          continue;
        }
        const result = await addLinkTag(id, workspaceId, selectedTagId);
        if (!result.ok) {
          results.push({ id, status: 'error', error: result.error });
          continue;
        }
      }
      else if (body.action === 'untag') {
        if (!selectedTagId) {
          results.push({ id, status: 'error', error: 'A tag is required.' });
          continue;
        }
        await removeLinkTag(id, workspaceId, selectedTagId);
      }
      else if (body.action === 'assignCampaign') {
        if (nextCampaignId === undefined) {
          results.push({ id, status: 'error', error: 'A campaign is required.' });
          continue;
        }
        const patch: { campaignId: string | null; utmCampaign?: string | null } = { campaignId: nextCampaignId };
        // A campaign owns utm_campaign. Clear the link value when attaching.
        if (nextCampaignId)
          patch.utmCampaign = null;
        const updated = await updateLink(id, workspaceId, patch);
        if (!updated) {
          results.push({ id, status: 'error', error: 'Not found.' });
          continue;
        }
      }
      results.push({ id, status: 'ok' });
      affected += 1;
    }
    catch {
      results.push({ id, status: 'error', error: 'Could not update link.' });
    }
  }

  await writeAuditEvent(
    'links_bulk_action',
    { action: body.action, count: affected },
    { workspaceId, actor: user.id },
  );

  return { affected, results };
});

async function resolveIds(ids: string[], workspaceId: string) {
  if (ids.length > BULK_LINK_CAP) {
    throw createError({
      statusCode: 422,
      statusMessage: `A bulk action holds at most ${BULK_LINK_CAP} links.`,
      data: { reason: `A bulk action holds at most ${BULK_LINK_CAP} links.`, count: ids.length },
    });
  }
  const unique = [...new Set(ids)];
  for (const id of unique) {
    if (!await findLinkById(id, workspaceId))
      throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  return unique;
}

async function resolveFilter(
  filter: v.InferOutput<typeof filterSchema>,
  workspaceId: string,
  userId: string,
) {
  const config = useRuntimeConfig();
  const rawDestination = filter.destination ?? '';
  const destination = rawDestination
    ? validateDestination(rawDestination, config.allowPrivateDestinations)
    : null;

  let createdBy = filter.createdBy;
  if (createdBy === 'me')
    createdBy = userId;

  const listQuery: LinkListQuery = {
    q: filter.q,
    destination: destination?.ok ? destination.url : undefined,
    status: filter.status,
    tags: filter.tags?.length ? filter.tags : undefined,
    campaignId: filter.campaignId,
    createdBy,
    archived: filter.archived ?? false,
    page: 1,
    perPage: 1,
    sort: filter.sort ?? 'createdAt',
  };

  const { total } = await listLinks(workspaceId, listQuery);
  if (total > BULK_LINK_CAP) {
    throw createError({
      statusCode: 422,
      statusMessage: `A bulk action holds at most ${BULK_LINK_CAP} links.`,
      data: { reason: `A bulk action holds at most ${BULK_LINK_CAP} links.`, count: total },
    });
  }
  if (total === 0)
    return [] as string[];

  const { items } = await listLinks(workspaceId, { ...listQuery, perPage: BULK_LINK_CAP });
  return items.map(item => item.id);
}
