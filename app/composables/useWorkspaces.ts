export type Workspace = { id: string; name: string; slug: string; linkPrefix: string | null; logoUrl: string | null; expiresAt: string | null; role: string; url: string };

// One key, so a refresh on the settings page updates the sidebar too.
export function useWorkspaces() {
  return useApi<{ currentId: string | null; items: Workspace[]; multiWorkspace: boolean }>('/api/workspaces', { key: 'workspaces' });
}

// The default layout fetches the list before any page renders, so this reads
// the cache and stays synchronous. An async component here would suspend every
// link row on its own.
export function useCurrentWorkspace() {
  const { data } = useNuxtData<{ currentId: string | null; items: Workspace[] }>('workspaces');
  const current = computed(() => data.value?.items.find(workspace => workspace.id === data.value?.currentId) ?? null);
  const canManageLinks = computed(() => current.value?.role !== 'VIEWER');
  return { current, canManageLinks };
}
