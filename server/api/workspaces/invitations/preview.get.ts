import * as v from 'valibot';
import { findUserByEmail } from '#server/utils/identity-repo';
import { findUsableInvitation } from '#server/utils/invitation-repo';
import { findWorkspaceById } from '#server/utils/workspace-repo';
import { roleName } from '#shared/permissions';

const querySchema = v.object({ token: v.pipe(v.string(), v.minLength(1)) });
const NOT_VALID = 'This invitation is not valid.';

function notValid() {
  return createError({ statusCode: 400, statusMessage: NOT_VALID, data: { reason: NOT_VALID } });
}

// Public. The token is the proof, so the answer names only what the invite
// email already told its reader.
export default defineEventHandler(async (event) => {
  const query = v.safeParse(querySchema, getQuery(event));
  if (!query.success)
    throw notValid();

  const found = await findUsableInvitation(query.output.token);
  if (!found.ok)
    throw notValid();

  const { invitation } = found;
  const workspace = await findWorkspaceById(invitation.workspaceId);
  if (!workspace)
    throw notValid();

  return {
    workspaceName: workspace.name,
    email: invitation.email,
    role: roleName(invitation.role ?? 'member'),
    accountExists: Boolean(await findUserByEmail(invitation.email)),
  };
});
