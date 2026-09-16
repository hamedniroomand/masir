import { findLinkBySlug } from '#server/utils/link-repo';
import { deriveLinkStatus } from '#shared/link-status';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkBySlug(slug);
  if (!link?.passwordHash) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    successfulVisitCount: link.successfulVisitCount,
  });

  if (status !== 'active') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  return {
    slug: link.slug,
    title: link.title,
  };
});
