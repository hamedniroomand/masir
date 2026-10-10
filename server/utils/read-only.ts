import type { WorkspaceRole } from '#shared/permissions';
import { parseEmailList } from '#server/utils/operator';

export function isReadOnlyEmail(email: string | undefined): boolean {
  if (!email)
    return false;
  return parseEmailList(useRuntimeConfig().readOnlyEmails || '').has(email.toLowerCase());
}

// A read-only account reads all that the owner reads. The read-only middleware
// refuses its writes, so the owner role grants it nothing more.
export function effectiveRole(email: string, role: WorkspaceRole): WorkspaceRole {
  return isReadOnlyEmail(email) ? 'OWNER' : role;
}
