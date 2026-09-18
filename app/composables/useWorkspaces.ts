export type Workspace = { id: string; name: string; slug: string; logoUrl: string | null; role: string; url: string };

// One key, so a refresh on the settings page updates the sidebar too.
export function useWorkspaces() {
  return useApi<{ currentId: string | null; items: Workspace[]; multiWorkspace: boolean }>('/api/workspaces', { key: 'workspaces' });
}
