import * as v from 'valibot';
import { requireUser } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { normalizeEmail } from '#server/utils/identity-repo';
import { acceptInvitation, findUsableInvitation } from '#server/utils/invitation-repo';
import { writeSecurityEvent } from '#server/utils/security-log';
import { findWorkspaceById } from '#server/utils/workspace-repo';

const bodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
});

const WRONG_EMAIL = 'This invitation belongs to another email address.';
const NOT_VALID = 'This invitation is not valid.';

export default defineEventHandler(async (event) => {
  // The route runs on the root host as well as a workspace host, so the
  // invitation names the workspace, not the request.
  const user = await requireUser(event);
  const body = await readValidBody(event, bodySchema);

  const found = await findUsableInvitation(body.token);
  if (!found.ok)
    throw createError({ statusCode: 400, statusMessage: NOT_VALID, data: { reason: NOT_VALID } });

  const { invitation } = found;

  // Only the invited address may accept. Anything else is a takeover path.
  if (normalizeEmail(user.email) !== invitation.email)
    throw createError({ statusCode: 403, statusMessage: WRONG_EMAIL, data: { reason: WRONG_EMAIL } });

  // The other path is workspace creation. Both refuse an unverified address,
  // which is what keeps an unverified account out of every workspace-scoped
  // handler. Do not drop this.
  if (!user.emailVerified) {
    const reason = 'Verify your email before you accept an invitation.';
    throw createError({ statusCode: 403, statusMessage: reason, data: { reason } });
  }

  const joined = await acceptInvitation(invitation.id, invitation.workspaceId, user.id);
  if (!joined)
    throw createError({ statusCode: 400, statusMessage: NOT_VALID, data: { reason: NOT_VALID } });

  await writeSecurityEvent('invitation_accepted', {}, { workspaceId: invitation.workspaceId, actor: user.id });

  const workspace = await findWorkspaceById(invitation.workspaceId);
  return { ok: true, workspace: workspace ? { slug: workspace.slug, name: workspace.name } : null };
});
