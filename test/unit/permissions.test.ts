import { describe, expect, it } from 'vitest';
import { can, roleLabel, roleName } from '#shared/permissions';

describe('can', () => {
  it('lets an owner do everything', () => {
    expect(can('OWNER', 'workspace.manage')).toBe(true);
    expect(can('OWNER', 'workspace.delete')).toBe(true);
    expect(can('OWNER', 'members.manage')).toBe(true);
    expect(can('OWNER', 'links.manage')).toBe(true);
    expect(can('OWNER', 'analytics.read')).toBe(true);
  });

  it('lets a member work with links and read analytics', () => {
    expect(can('MEMBER', 'links.manage')).toBe(true);
    expect(can('MEMBER', 'analytics.read')).toBe(true);
  });

  it('refuses a member the workspace and member controls', () => {
    expect(can('MEMBER', 'workspace.manage')).toBe(false);
    expect(can('MEMBER', 'workspace.delete')).toBe(false);
    expect(can('MEMBER', 'members.manage')).toBe(false);
  });
});

describe('viewer role', () => {
  it('lets a viewer read links and analytics', () => {
    expect(can('VIEWER', 'links.read')).toBe(true);
    expect(can('VIEWER', 'analytics.read')).toBe(true);
  });

  it('refuses a viewer every write', () => {
    expect(can('VIEWER', 'links.manage')).toBe(false);
    expect(can('VIEWER', 'workspace.manage')).toBe(false);
    expect(can('VIEWER', 'workspace.delete')).toBe(false);
    expect(can('VIEWER', 'members.manage')).toBe(false);
  });

  it('lets an owner and a member read links', () => {
    expect(can('OWNER', 'links.read')).toBe(true);
    expect(can('MEMBER', 'links.read')).toBe(true);
  });
});

describe('role labels', () => {
  it('round trips every role', () => {
    for (const role of ['OWNER', 'MEMBER', 'VIEWER'] as const)
      expect(roleName(roleLabel(role))).toBe(role);
  });

  it('maps the viewer label', () => {
    expect(roleLabel('VIEWER')).toBe('viewer');
    expect(roleName('viewer')).toBe('VIEWER');
  });
});
