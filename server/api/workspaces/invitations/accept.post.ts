import { TransactionRollbackError } from 'drizzle-orm';
import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findUserByEmail, normalizeEmail, setSessionUser } from '#server/utils/identity-repo';
import { acceptInvitation, acceptInvitationAsNewUser, findUsableInvitation } from '#server/utils/invitation-repo';
import { hashSecret } from '#server/utils/password';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { findWorkspaceById } from '#server/utils/workspace-repo';
import { accountPasswordSchema } from '#shared/account-password';

const bodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  password: v.optional(accountPasswordSchema),
});

const WRONG_EMAIL = 'This invitation belongs to another email address.';
const NOT_VALID = 'This invitation is not valid.';
const SIGN_IN = 'Sign in to accept this invitation.';

function fail(statusCode: number, reason: string) {
  return createError({ statusCode, statusMessage: reason, data: { reason } });
}

export default defineEventHandler(async (event) => {
  // The route runs on the root host as well as a workspace host, so the
  // invitation names the workspace, not the request.
  const body = await readValidBody(event, bodySchema);
  const session = await getUserSession(event);
  const signedIn = Boolean(session.user);

  // The new-user path hashes a password with argon2id, so it gets the same
  // guard as sign-in.
  if (!signedIn) {
    const config = useRuntimeConfig();
    const limit = await rateLimitCheck(`invite-accept:${await hashClientKey(event)}`, config.rateLimitLoginPerMinute, 60_000);
    if (!limit.ok) {
      setResponseHeader(event, 'Retry-After', limit.retryAfterSec);
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
    }
  }

  const found = await findUsableInvitation(body.token);
  if (!found.ok)
    throw fail(400, NOT_VALID);
  const { invitation } = found;

  let userId: string;
  if (signedIn) {
    const user = await requireUser(event);
    // Only the invited address may accept. Anything else is a takeover path.
    if (normalizeEmail(user.email) !== invitation.email)
      throw fail(403, WRONG_EMAIL);
    if (!await acceptInvitation(invitation.id, invitation.workspaceId, user.id, invitation.role))
      throw fail(400, NOT_VALID);
    userId = user.id;
  }
  else {
    if (!body.password)
      throw fail(401, SIGN_IN);
    if (await findUserByEmail(invitation.email))
      throw fail(409, SIGN_IN);

    // A rollback means the invitation or the email is already taken.
    const created = await acceptInvitationAsNewUser({
      invitationId: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      passwordHash: await hashSecret(body.password),
      role: invitation.role,
    }).catch((error: unknown) => {
      if (error instanceof TransactionRollbackError)
        return null;
      throw error;
    });
    if (!created)
      throw fail(400, NOT_VALID);

    await setSessionUser(event, created);
    await writeAuditEvent('user_registered', { email: created.email, via: 'invitation' }, { actor: created.id });
    userId = created.id;
  }

  await writeAuditEvent('invitation_accepted', {}, { workspaceId: invitation.workspaceId, actor: userId });

  const workspace = await findWorkspaceById(invitation.workspaceId);
  return { ok: true, workspace: workspace ? { slug: workspace.slug, name: workspace.name } : null };
});
