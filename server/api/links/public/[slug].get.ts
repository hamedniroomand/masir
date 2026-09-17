import { findLinkBySlug } from '#server/utils/link-repo';
import { deriveLinkStatus } from '#shared/link-status';

export default defineEventHandler(async (event) => {
  // This route is public. The workspace comes from the hostname, never from
  // the caller, or one workspace could read another workspace's link.
  const workspace = event.context.workspace as { id: string } | undefined;
  const slug = getRouterParam(event, 'slug');
  if (!workspace || !slug)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkBySlug(workspace.id, slug);
  if (!link?.passwordHash) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    clickCount: link.clickCount,
  });

  if (status !== 'active') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  return {
    slug: link.slug,
    title: link.title,
  };
});
