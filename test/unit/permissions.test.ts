import { describe, expect, it } from 'vitest';
import { can } from '#shared/permissions';

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
