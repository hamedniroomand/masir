import type { H3Event } from 'h3';
import type { Permission, WorkspaceRole } from '#shared/permissions';
import { sessionVersionOf } from '#server/utils/identity-repo';
import { findMemberAccess } from '#server/utils/workspace-repo';
import { can } from '#shared/permissions';

// The session is sealed as JSON, so it holds a flag and not a date. A Date
// would come back as a string and every comparison on it would be wrong.
export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  sessionVersion: number;
};

export type WorkspaceContext = {
  workspaceId: string;
  role: WorkspaceRole;
};

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const session = await requireUserSession(event);
  const user = session.user as SessionUser;

  // A sealed cookie cannot be withdrawn, so the server compares its version
  // against the user record. A password change raises the number and every
  // older cookie stops working.
  const current = await sessionVersionOf(user.id);
  if (current == null || current !== user.sessionVersion) {
    await clearUserSession(event);
    throw createError({ statusCode: 401, statusMessage: 'Sign in again.' });
  }

  return user;
}

// A stranger and a member without the permission get the same answer. A 403
// would confirm that the workspace exists.
export function workspaceNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Workspace not found' });
}

// For a route that names its workspace in the request. The root domain sets no
// event.context.workspace, so the onboarding page cannot use the guard below.
export async function requireMemberOf(
  event: H3Event,
  workspaceId: string,
  permission: Permission,
): Promise<WorkspaceContext> {
  const session = await requireUserSession(event);
  const user = session.user as SessionUser;

  // One read covers the session version and the membership. Checking them
  // apart would cost two round trips on every workspace request.
  const access = await findMemberAccess(workspaceId, user.id);

  if (!access || access.sessionVersion !== user.sessionVersion) {
    if (access)
      await clearUserSession(event);
    throw workspaceNotFound();
  }

  const role = access.role as WorkspaceRole;
  if (!can(role, permission))
    throw workspaceNotFound();

  return { workspaceId, role };
}

export async function requireWorkspaceMember(
  event: H3Event,
  permission: Permission,
): Promise<WorkspaceContext> {
  const workspace = event.context.workspace as { id: string } | undefined;
  if (!workspace)
    throw workspaceNotFound();
  return requireMemberOf(event, workspace.id, permission);
}
