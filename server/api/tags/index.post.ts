import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { InvalidTagNameError } from '#server/utils/errors';
import { createTag, tagToDto } from '#server/utils/tag-repo';
import { tagNameSchema } from '#shared/link-input';

const bodySchema = v.object({ name: tagNameSchema });

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);
  try {
    const tag = await createTag(user.id, body.name);
    if (!tag)
      throw createError({ statusCode: 500, statusMessage: 'Could not create tag.' });
    setResponseStatus(event, 201);
    return tagToDto(tag);
  }
  catch (e) {
    if (e instanceof InvalidTagNameError) {
      throw createError({ statusCode: 422, statusMessage: 'Enter a tag name.', data: { reason: 'Enter a tag name.' } });
    }
    throw e;
  }
});
