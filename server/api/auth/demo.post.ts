import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { readValidBody } from '#server/utils/body';
import { createDemoWorkspace, DEMO_CREATES_PER_HOUR } from '#server/utils/demo';
import { setSessionUser } from '#server/utils/identity-repo';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { requireHuman } from '#server/utils/turnstile';
import { workspaceUrl } from '#shared/deployment';

// The body may be empty. Only the robot check token travels in it.
const bodySchema = v.optional(v.object({ turnstileToken: v.optional(v.string()) }), {});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  // Without the gate the route does not exist, so a deployment that never set
  // it gives nothing away.
  if (!config.demoEnabled)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);
  await requireHuman(event, body.turnstileToken);

  // Each call writes a few hundred rows. A visitor needs one demo, not a loop.
  const clientKey = await hashClientKey(event);
  const rl = await rateLimitCheck(`demo:${clientKey}`, DEMO_CREATES_PER_HOUR, 3_600_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const { user, workspace } = await createDemoWorkspace();
  await writeAuditEvent('demo_created', { slug: workspace.slug }, { workspaceId: workspace.id, actor: user.id });
  await setSessionUser(event, user, { demo: true });

  setResponseStatus(event, 201);
  return { url: workspaceUrl(workspace.slug, config as never) };
});
