export type WorkspaceRole = 'OWNER' | 'MEMBER' | 'VIEWER';

// The API keeps its uppercase strings. The database keeps lowercase enum
// labels. These two maps are the only place the two spellings meet.
export type MemberRoleLabel = 'owner' | 'member' | 'viewer';

const ROLE_LABEL: Record<WorkspaceRole, MemberRoleLabel> = {
  OWNER: 'owner',
  MEMBER: 'member',
  VIEWER: 'viewer',
};

const ROLE_NAME: Record<MemberRoleLabel, WorkspaceRole> = {
  owner: 'OWNER',
  member: 'MEMBER',
  viewer: 'VIEWER',
};

export function roleLabel(role: WorkspaceRole): MemberRoleLabel {
  return ROLE_LABEL[role];
}

export function roleName(label: MemberRoleLabel): WorkspaceRole {
  return ROLE_NAME[label];
}

export type Permission
  = | 'workspace.manage'
    | 'workspace.delete'
    | 'members.manage'
    | 'links.manage'
    | 'links.read'
    | 'analytics.read';

const BY_ROLE: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([
    'workspace.manage',
    'workspace.delete',
    'members.manage',
    'links.manage',
    'links.read',
    'analytics.read',
  ]),
  MEMBER: new Set<Permission>([
    'links.manage',
    'links.read',
    'analytics.read',
  ]),
  VIEWER: new Set<Permission>([
    'links.read',
    'analytics.read',
  ]),
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return BY_ROLE[role].has(permission);
}
