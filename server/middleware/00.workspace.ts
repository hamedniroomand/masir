import { findSingleWorkspace, findWorkspaceBySlug } from '#server/utils/workspace-repo';
import { appUrl } from '#shared/deployment';
import { RESERVED_WORKSPACE_SLUGS } from '#shared/workspace-slug';

function hostnameOf(host: string): string {
  return host.toLowerCase().split(':')[0] ?? host;
}

function subdomainOf(bare: string, rootHost: string): string | null {
  if (bare === rootHost)
    return null;
  if (!bare.endsWith(`.${rootHost}`))
    return null;
  const label = bare.slice(0, -(rootHost.length + 1));
  return label.includes('.') ? null : label;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const host = getRequestHeader(event, 'host');
  const bare = host ? hostnameOf(host) : '';
  const rootHost = new URL(config.rootDomain).hostname;
  const appHost = new URL(appUrl(config as never)).hostname;
  // The root serves a landing page only when the app lives somewhere else.
  event.context.landing = appHost !== rootHost && bare === rootHost;

  if (!config.multiWorkspace) {
    const workspace = await findSingleWorkspace();
    if (workspace)
      event.context.workspace = workspace;
    return;
  }

  if (!host || bare === appHost)
    return;

  const label = subdomainOf(bare, rootHost);
  if (!label || RESERVED_WORKSPACE_SLUGS.has(label))
    return;

  const workspace = await findWorkspaceBySlug(label);
  if (!workspace) {
    // Nuxt renders the error page with a second request on the same host. A
    // 404 here too would leave only the bare Nitro fallback.
    if (event.path.startsWith('/__nuxt_error'))
      return;
    // Never make a workspace from a hostname.
    throw createError({
      statusCode: 404,
      statusMessage: 'Workspace not found',
      data: { reason: 'workspace_not_found', home: appUrl(config as never) },
    });
  }

  event.context.workspace = workspace;
});
