export const LINK_TABS = ['overview', 'settings', 'history'] as const;

export type LinkTab = typeof LINK_TABS[number];

// The #analytics hash targets this tab.
export const ANALYTICS_TAB: LinkTab = 'overview';

export function resolveLinkTab(tab?: string | null, hash?: string | null): LinkTab {
  if (LINK_TABS.includes(tab as LinkTab))
    return tab as LinkTab;
  if (hash === '#analytics')
    return ANALYTICS_TAB;
  return 'overview';
}
