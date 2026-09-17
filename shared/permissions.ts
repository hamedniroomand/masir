export type WorkspaceRole = 'OWNER' | 'MEMBER';
export type WorkspacePlan = 'TRIAL' | 'ACTIVE' | 'TRIAL_EXPIRED';

// The API keeps its uppercase strings. The database keeps lowercase enum
// labels. These four maps are the only place the two spellings meet.
export type MemberRoleLabel = 'owner' | 'member';
export type WorkspacePlanLabel = 'trial' | 'active' | 'trial_expired';

const ROLE_LABEL: Record<WorkspaceRole, MemberRoleLabel> = {
  OWNER: 'owner',
  MEMBER: 'member',
};

const ROLE_NAME: Record<MemberRoleLabel, WorkspaceRole> = {
  owner: 'OWNER',
  member: 'MEMBER',
};

const PLAN_LABEL: Record<WorkspacePlan, WorkspacePlanLabel> = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  TRIAL_EXPIRED: 'trial_expired',
};

const PLAN_NAME: Record<WorkspacePlanLabel, WorkspacePlan> = {
  trial: 'TRIAL',
  active: 'ACTIVE',
  trial_expired: 'TRIAL_EXPIRED',
};

export function roleLabel(role: WorkspaceRole): MemberRoleLabel {
  return ROLE_LABEL[role];
}

export function roleName(label: MemberRoleLabel): WorkspaceRole {
  return ROLE_NAME[label];
}

export function planLabel(plan: WorkspacePlan): WorkspacePlanLabel {
  return PLAN_LABEL[plan];
}

export function planName(label: WorkspacePlanLabel): WorkspacePlan {
  return PLAN_NAME[label];
}

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
