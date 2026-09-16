import { requireUser } from '#server/utils/auth';
import { listTags } from '#server/utils/tag-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  return { items: await listTags(user.id) };
});
