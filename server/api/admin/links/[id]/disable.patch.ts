import { requireAdmin } from '#server/utils/auth';
import { adminDisableLink } from '#server/utils/link-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await adminDisableLink(id);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  await writeSecurityEvent('link_disabled_by_admin', { slug: link.slug }, admin.id, id);
  return { ok: true };
});
