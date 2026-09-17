import { inviteMessage } from '#server/emails/invite';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { findInvitationById, replaceInvitationToken } from '#server/utils/invitation-repo';
import { sendMail } from '#server/utils/mail';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { writeSecurityEvent } from '#server/utils/security-log';
import { workspaceUrl } from '#shared/deployment';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'members.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as { slug: string; name: string };
  const config = useRuntimeConfig();

  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const limit = Number(config.rateLimitInvitePerHour) || 30;
  const rl = await rateLimitCheck(`invite:${workspaceId}`, limit, 3_600_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const invitation = await findInvitationById(id, workspaceId);
  if (!invitation || invitation.acceptedAt || invitation.revokedAt)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // A resend replaces the token, so the previous link stops working.
  const raw = await replaceInvitationToken(id);
  const base = workspaceUrl(workspace.slug, config as never);
  await sendMail(inviteMessage(invitation.email, workspace.name, `${base}/invite?token=${raw}`));
  await writeSecurityEvent('invitation_resent', { invitationId: id }, user.id);

  return { ok: true };
});
