import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { can } from '#shared/permissions';
import { useConfirmDiscard } from '../../app/composables/useConfirmDiscard';

describe('useConfirmDiscard', () => {
  let confirmMock: MockInstance;

  beforeEach(() => {
    confirmMock = vi.fn();
    (globalThis as unknown as { window: { confirm: typeof confirmMock } }).window = {
      confirm: confirmMock,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('allows discard immediately when not dirty', () => {
    const isDirty = ref(false);

    const { canDiscard } = useConfirmDiscard(isDirty);
    expect(canDiscard()).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('prompts window.confirm when dirty', () => {
    const isDirty = ref(true);
    confirmMock.mockReturnValue(false);

    const { canDiscard } = useConfirmDiscard(isDirty);
    expect(canDiscard()).toBe(false);
    expect(confirmMock).toHaveBeenCalledWith('Discard unsaved changes?');

    confirmMock.mockReturnValue(true);
    expect(canDiscard()).toBe(true);
  });

  it('guards slideover open state update', () => {
    const isDirty = ref(true);
    const open = ref(true);
    confirmMock.mockReturnValue(false);

    const { handleOpenUpdate } = useConfirmDiscard(isDirty, open);

    // Attempt to close while dirty, user cancels
    handleOpenUpdate(false);
    expect(open.value).toBe(true);

    // User confirms
    confirmMock.mockReturnValue(true);
    handleOpenUpdate(false);
    expect(open.value).toBe(false);
  });
});

describe('permission-based checks', () => {
  it('gives OWNER full manage permissions', () => {
    expect(can('OWNER', 'workspace.manage')).toBe(true);
    expect(can('OWNER', 'workspace.delete')).toBe(true);
    expect(can('OWNER', 'members.manage')).toBe(true);
    expect(can('OWNER', 'links.manage')).toBe(true);
  });

  it('gives MEMBER link manage but not workspace manage', () => {
    expect(can('MEMBER', 'workspace.manage')).toBe(false);
    expect(can('MEMBER', 'workspace.delete')).toBe(false);
    expect(can('MEMBER', 'members.manage')).toBe(false);
    expect(can('MEMBER', 'links.manage')).toBe(true);
    expect(can('MEMBER', 'links.read')).toBe(true);
  });

  it('gives VIEWER read only', () => {
    expect(can('VIEWER', 'workspace.manage')).toBe(false);
    expect(can('VIEWER', 'links.manage')).toBe(false);
    expect(can('VIEWER', 'links.read')).toBe(true);
  });
});
