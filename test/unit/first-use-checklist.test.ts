import { beforeEach, describe, expect, it } from 'vitest';

describe('first-use checklist state', () => {
  const workspaceId = 'ws-test-123';
  const storageKey = `masir:first-use:${workspaceId}`;
  const mockStorage = new Map<string, string>();

  const storage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    clear: () => mockStorage.clear(),
  };

  beforeEach(() => {
    storage.clear();
  });

  it('determines visibility based on link count and dismissed state', () => {
    const isVisible = (linkCount: number, dismissed: boolean, canManageLinks: boolean) => {
      return canManageLinks && !dismissed && linkCount < 3;
    };

    // New workspace with 0 links for a link manager
    expect(isVisible(0, false, true)).toBe(true);
    // Workspace with 2 links
    expect(isVisible(2, false, true)).toBe(true);
    // Workspace with 3 links
    expect(isVisible(3, false, true)).toBe(false);
    // Dismissed workspace
    expect(isVisible(1, true, true)).toBe(false);
    // Viewer role cannot manage links
    expect(isVisible(0, false, false)).toBe(false);
  });

  it('persists dismissal in localStorage', () => {
    expect(storage.getItem(storageKey)).toBeNull();

    // Dismiss
    storage.setItem(storageKey, JSON.stringify({ dismissed: true, shared: false, inspected: false }));

    const raw = storage.getItem(storageKey);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.dismissed).toBe(true);
  });

  it('tracks step progression (created, shared, inspected)', () => {
    type Steps = { linkCount: number; shared: boolean; inspected: boolean };
    const getSteps = ({ linkCount, shared, inspected }: Steps) => ({
      createdStep: linkCount > 0,
      sharedStep: shared,
      inspectedStep: inspected,
    });

    expect(getSteps({ linkCount: 0, shared: false, inspected: false })).toEqual({
      createdStep: false,
      sharedStep: false,
      inspectedStep: false,
    });

    expect(getSteps({ linkCount: 1, shared: true, inspected: false })).toEqual({
      createdStep: true,
      sharedStep: true,
      inspectedStep: false,
    });

    expect(getSteps({ linkCount: 1, shared: true, inspected: true })).toEqual({
      createdStep: true,
      sharedStep: true,
      inspectedStep: true,
    });
  });
});
