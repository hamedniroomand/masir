import * as v from 'valibot';
import { inviteMessage } from '#server/emails/invite';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { createInvitation, isAlreadyMember } from '#server/utils/invitation-repo';
import { sendMail } from '#server/utils/mail';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { writeSecurityEvent } from '#server/utils/security-log';
import { workspaceUrl } from '#shared/deployment';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as { slug: string; name: string };
  const config = useRuntimeConfig();

  const limit = Number(config.rateLimitInvitePerHour) || 30;
  const rl = await rateLimitCheck(`invite:${workspaceId}`, limit, 3_600_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const body = await readValidBody(event, bodySchema);

  if (await isAlreadyMember(workspaceId, body.email)) {
    const reason = 'This person is already a member.';
    throw createError({ statusCode: 409, statusMessage: reason, data: { reason } });
  }

  const { id, raw } = await createInvitation({
    workspaceId,
    email: body.email,
    invitedByUserId: user.id,
  });

  const base = workspaceUrl(workspace.slug, config as never);
  await sendMail(inviteMessage(body.email, workspace.name, `${base}/invite?token=${raw}`));
  await writeSecurityEvent('invitation_sent', { email: body.email }, { workspaceId, actor: user.id });

  setResponseStatus(event, 201);
  return { id, email: body.email };
});
