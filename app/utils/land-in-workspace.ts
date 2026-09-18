type WorkspaceLanding = { url: string };

// One workspace goes straight there. Several offer a choice. None means this
// person has nowhere to land yet.
export function landInWorkspace(items: WorkspaceLanding[]) {
  if (items.length === 0)
    return navigateTo('/workspaces/new');
  if (items.length > 1)
    return navigateTo('/workspaces');
  const url = items[0]?.url ?? '/';
  // A workspace lives on its own host, so this is a navigation, not a route.
  if (new URL(url, window.location.origin).origin !== window.location.origin) {
    window.location.href = url;
    return;
  }
  return navigateTo('/');
}
