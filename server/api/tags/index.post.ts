import * as v from 'valibot';
import { requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { InvalidTagNameError } from '#server/utils/errors';
import { createTag, tagToDto } from '#server/utils/tag-repo';
import { tagNameSchema } from '#shared/link-input';

const bodySchema = v.object({ name: tagNameSchema });

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const body = await readValidBody(event, bodySchema);
  try {
    const tag = await createTag(workspaceId, body.name);
    if (!tag)
      throw createError({ statusCode: 500, statusMessage: 'Could not create tag.' });
    setResponseStatus(event, 201);
    return tagToDto(tag);
  }
  catch (error) {
    if (error instanceof InvalidTagNameError) {
      throw createError({ statusCode: 422, statusMessage: 'Enter a tag name.', data: { reason: 'Enter a tag name.' } });
    }
    throw error;
  }
});
