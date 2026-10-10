import type { Permission, WorkspaceRole } from '#shared/permissions';
import { can as checkPermission } from '#shared/permissions';

export type Workspace = { id: string; name: string; slug: string; linkPrefix: string | null; logoUrl: string | null; role: string; url: string };

type WorkspaceList = { currentId: string | null; readOnly: boolean; items: Workspace[] };

// One key, so a refresh on the settings page updates the sidebar too.
export function useWorkspaces() {
  return useApi<WorkspaceList>('/api/workspaces', { key: 'workspaces' });
}

// The default layout fetches the list before any page renders, so this reads
// the cache and stays synchronous. An async component here would suspend every
// link row on its own.
export function useCurrentWorkspace() {
  const { data } = useNuxtData<WorkspaceList>('workspaces');
  const current = computed(() => data.value?.items.find(workspace => workspace.id === data.value?.currentId) ?? null);
  const readOnly = computed(() => data.value?.readOnly === true);
  const canManageLinks = computed(() => current.value?.role !== 'VIEWER');
  const can = (permission: Permission): boolean => {
    const role = current.value?.role as WorkspaceRole | undefined;
    if (!role)
      return false;
    return checkPermission(role, permission);
  };
  return { current, readOnly, canManageLinks, can };
}
