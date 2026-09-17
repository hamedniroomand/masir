import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { isUniqueViolation } from '#server/utils/db';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { writeSecurityEvent } from '#server/utils/security-log';
import {
  countWorkspaces,
  createWorkspaceWithOwner,
  isWorkspaceSlugTaken,
} from '#server/utils/workspace-repo';
import { normalizeWorkspaceSlug, workspaceSlugSchema } from '#shared/workspace-slug';

const bodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a workspace name.'), v.maxLength(120)),
  slug: v.optional(v.string()),
  logoUrl: v.optional(v.nullable(v.string())),
});

const SLUG_TAKEN = 'This workspace address is taken.';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();

  if (!user.emailVerified) {
    const reason = 'Verify your email before you make a workspace.';
    throw createError({ statusCode: 403, statusMessage: reason, data: { reason } });
  }

  // Link limits are keyed by workspace, so a caller who makes workspaces freely
  // resets them. Key this one on the user.
  const limit = await rateLimitCheck(
    `workspace-create:${user.id}`,
    Number(config.rateLimitWorkspacePerDay) || 5,
    86_400_000,
  );
  if (!limit.ok) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  // One workspace for a single-workspace instance. The server refuses the
  // second one; hiding the button is not enough.
  if (!config.multiWorkspace && await countWorkspaces() > 0) {
    const reason = 'This instance holds one workspace.';
    throw createError({ statusCode: 409, statusMessage: reason, data: { reason } });
  }

  const body = await readValidBody(event, bodySchema);
  const requested = body.slug ?? normalizeWorkspaceSlug(body.name);
  const parsed = v.safeParse(workspaceSlugSchema, requested);
  if (!parsed.success) {
    const reason = parsed.issues[0]?.message ?? 'Invalid input.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  if (await isWorkspaceSlugTaken(parsed.output))
    throw createError({ statusCode: 409, statusMessage: SLUG_TAKEN, data: { reason: SLUG_TAKEN } });

  try {
    const workspace = await createWorkspaceWithOwner({
      name: body.name,
      slug: parsed.output,
      logoUrl: body.logoUrl ?? null,
      ownerUserId: user.id,
      trialDays: config.deploymentMode === 'CLOUD' ? Number(config.trialDays) : null,
    });
    await writeSecurityEvent('workspace_created', { slug: workspace.slug }, { workspaceId: workspace.id, actor: user.id });
    setResponseStatus(event, 201);
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      plan: workspace.plan,
      trialEndsAt: workspace.trialEndsAt,
    };
  }
  catch (error) {
    // Two requests can pass the check at the same time. The unique index is
    // what actually decides.
    if (isUniqueViolation(error))
      throw createError({ statusCode: 409, statusMessage: SLUG_TAKEN, data: { reason: SLUG_TAKEN } });
    throw error;
  }
});
