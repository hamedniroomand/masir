export type WorkspaceRole = 'OWNER' | 'MEMBER';

export type Permission
  = | 'workspace.manage'
    | 'workspace.delete'
    | 'members.manage'
    | 'links.manage'
    | 'analytics.read';

const BY_ROLE: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([
    'workspace.manage',
    'workspace.delete',
    'members.manage',
    'links.manage',
    'analytics.read',
  ]),
  MEMBER: new Set<Permission>([
    'links.manage',
    'analytics.read',
  ]),
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return BY_ROLE[role].has(permission);
}
