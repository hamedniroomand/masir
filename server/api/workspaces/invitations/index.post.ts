import * as v from 'valibot';
import { inviteMessage } from '#server/emails/invite';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { isUniqueViolation } from '#server/utils/db';
import { createInvitation, isAlreadyMember } from '#server/utils/invitation-repo';
import { sendMail } from '#server/utils/mail';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { workspaceUrl } from '#shared/deployment';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
  // A workspace holds one owner, and only transfer changes who that is.
  role: v.optional(v.picklist(['MEMBER', 'VIEWER'], 'Choose Member or Viewer.')),
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

  // The partial unique index refuses a second open invitation for the same
  // address. Two requests can pass every check above at the same time, so the
  // index is what actually decides.
  const invitation = await createInvitation({
    workspaceId,
    email: body.email,
    invitedBy: user.id,
    role: body.role,
  }).catch((error) => {
    if (isUniqueViolation(error)) {
      const reason = 'This address already has an open invitation.';
      throw createError({ statusCode: 409, statusMessage: reason, data: { reason } });
    }
    throw error;
  });
  const { id, raw } = invitation;

  const base = workspaceUrl(workspace.slug, config as never);
  await sendMail(inviteMessage(body.email, workspace.name, `${base}/invite?token=${raw}`));
  await writeAuditEvent('invitation_sent', { email: body.email }, { workspaceId, actor: user.id });

  setResponseStatus(event, 201);
  return { id, email: body.email };
});
