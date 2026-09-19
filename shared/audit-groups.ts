export const AUDIT_GROUPS = ['links', 'campaigns', 'members', 'security'] as const;

export type AuditGroup = typeof AUDIT_GROUPS[number];

// Every type the server writes today. A type that is not here falls into
// security, and the security query excludes the other groups rather than
// listing its own, so a new event is never hidden.
const GROUP_OF_TYPE: Record<string, AuditGroup> = {
  link_created: 'links',
  link_updated: 'links',
  link_deleted: 'links',
  link_slug_changed: 'links',
  link_alias_added: 'links',
  link_alias_removed: 'links',
  link_alert_sent: 'links',
  link_password_set: 'links',
  link_password_removed: 'links',
  slug_generation_exhausted: 'links',

  campaign_created: 'campaigns',
  campaign_updated: 'campaigns',
  campaign_deleted: 'campaigns',

  invitation_sent: 'members',
  invitation_accepted: 'members',
  invitation_resent: 'members',
  invitation_revoked: 'members',
  member_activity_changed: 'members',
  member_role_changed: 'members',
  member_removed: 'members',
  ownership_transferred: 'members',

  abuse_report: 'security',
  email_verified: 'security',
  identity_disconnected: 'security',
  login_failed: 'security',
  oauth_failed: 'security',
  oauth_login: 'security',
  oauth_refused: 'security',
  password_reset: 'security',
  rate_limit_exceeded: 'security',
  register_duplicate: 'security',
  user_registered: 'security',
  workspace_created: 'security',
  workspace_updated: 'security',
  workspace_deleted: 'security',
};

export function auditGroup(type: string): AuditGroup {
  return GROUP_OF_TYPE[type] ?? 'security';
}

export function typesInGroup(group: AuditGroup): string[] {
  return Object.entries(GROUP_OF_TYPE).filter(([, value]) => value === group).map(([type]) => type);
}

// Security is the catch-all, so a query for it excludes the other groups
// instead of listing its own types. A type nobody mapped still shows there.
export function typesOutsideGroup(group: AuditGroup): string[] {
  return Object.entries(GROUP_OF_TYPE).filter(([, value]) => value !== group).map(([type]) => type);
}

export function isAuditGroup(value: unknown): value is AuditGroup {
  return AUDIT_GROUPS.includes(value as AuditGroup);
}
