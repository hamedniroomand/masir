import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { isWorkspaceSlugTaken } from '#server/utils/workspace-repo';
import { workspaceSlugSchema } from '#shared/workspace-slug';

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const config = useRuntimeConfig();
  const clientKey = await hashClientKey(event);
  const limit = Number(config.rateLimitSlugCheckPerMinute) || 30;
  const rl = await rateLimitCheck(`slug:${clientKey}`, limit, 60_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const raw = getQuery(event).slug;
  const parsed = v.safeParse(workspaceSlugSchema, typeof raw === 'string' ? raw : '');
  if (!parsed.success)
    return { available: false, reason: parsed.issues[0]?.message ?? 'Invalid input.' };

  return { available: !await isWorkspaceSlugTaken(parsed.output), slug: parsed.output };
});
