import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { isUniqueViolation } from '#server/utils/db';
import { AliasLimitError } from '#server/utils/errors';
import { addAlias, findLinkById, isSlugTaken } from '#server/utils/link-repo';
import { MAX_ALIASES_PER_LINK } from '#shared/link-input';
import { slugSchema } from '#shared/slug';

const bodySchema = v.object({ slug: slugSchema });

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);

  if (await isSlugTaken(workspaceId, body.slug, id)) {
    const reason = 'This short link is already taken.';
    throw createError({ statusCode: 409, statusMessage: reason, data: { reason } });
  }

  try {
    await addAlias(workspaceId, id, body.slug);
  }
  catch (error) {
    if (error instanceof AliasLimitError) {
      const reason = `A link holds at most ${MAX_ALIASES_PER_LINK} aliases.`;
      throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
    }
    // Two requests can pass the check above at the same time. The primary key
    // is what actually decides.
    if (isUniqueViolation(error)) {
      const reason = 'This short link is already taken.';
      throw createError({ statusCode: 409, statusMessage: reason, data: { reason } });
    }
    throw error;
  }

  await writeAuditEvent('link_alias_added', { slug: body.slug }, { workspaceId, actor: user.id, linkId: id });
  setResponseStatus(event, 201);
  return { slug: body.slug };
});
