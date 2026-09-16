import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { findTagForUser, InvalidTagNameError, renameTag, tagToDto } from '#server/utils/tag-repo';

const bodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const existing = await findTagForUser(id, user.id);
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = v.parse(bodySchema, await readBody(event));
  try {
    const updated = await renameTag(id, user.id, body.name);
    if (!updated)
      throw createError({ statusCode: 404, statusMessage: 'Not found' });
    return tagToDto(updated);
  }
  catch (e) {
    if (e instanceof InvalidTagNameError) {
      throw createError({ statusCode: 422, statusMessage: 'A tag with this name already exists.', data: { reason: 'A tag with this name already exists.' } });
    }
    throw e;
  }
});
