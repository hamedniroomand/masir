import * as v from 'valibot';
import { requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { InvalidTagNameError, TagNameTakenError } from '#server/utils/errors';
import { findTagForWorkspace, renameTag, tagToDto } from '#server/utils/tag-repo';
import { tagNameSchema } from '#shared/link-input';

const bodySchema = v.object({ name: tagNameSchema });

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findTagForWorkspace(id, workspaceId);
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);
  try {
    const updated = await renameTag(id, workspaceId, body.name);
    if (!updated)
      throw createError({ statusCode: 404, statusMessage: 'Not found' });
    return tagToDto(updated);
  }
  catch (e) {
    if (e instanceof TagNameTakenError) {
      throw createError({ statusCode: 409, statusMessage: 'A tag with this name already exists.', data: { reason: 'A tag with this name already exists.' } });
    }
    if (e instanceof InvalidTagNameError) {
      throw createError({ statusCode: 422, statusMessage: 'Enter a tag name.', data: { reason: 'Enter a tag name.' } });
    }
    throw e;
  }
});
