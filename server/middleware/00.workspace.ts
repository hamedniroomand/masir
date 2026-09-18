import { findSingleWorkspace, findWorkspaceBySlug } from '#server/utils/workspace-repo';
import { RESERVED_WORKSPACE_SLUGS } from '#shared/workspace-slug';

function subdomainOf(host: string, rootDomain: string): string | null {
  const rootHost = new URL(rootDomain).hostname;
  const [bare = host] = host.toLowerCase().split(':');
  if (bare === rootHost)
    return null;
  if (!bare.endsWith(`.${rootHost}`))
    return null;
  const label = bare.slice(0, -(rootHost.length + 1));
  return label.includes('.') ? null : label;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  if (!config.multiWorkspace) {
    const workspace = await findSingleWorkspace();
    if (workspace)
      event.context.workspace = workspace;
    return;
  }

  const host = getRequestHeader(event, 'host');
  if (!host)
    return;

  const label = subdomainOf(host, config.rootDomain);
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
      data: { reason: 'workspace_not_found', home: config.rootDomain },
    });
  }

  event.context.workspace = workspace;
});
