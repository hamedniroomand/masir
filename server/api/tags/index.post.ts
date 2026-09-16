import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { createTag, InvalidTagNameError, tagToDto } from '#server/utils/tag-repo';

const bodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = v.parse(bodySchema, await readBody(event));
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
