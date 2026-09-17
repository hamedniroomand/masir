export type DeploymentMode = 'CLOUD' | 'SELF_HOSTED';

export type DeploymentConfig = {
  deploymentMode: DeploymentMode;
  rootDomain: string;
  multiWorkspace: boolean;
  allowRegistration: boolean;
};

const IP_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$|^\[[\da-f:]+\]$/i;

export function isCloud(config: DeploymentConfig) {
  return config.deploymentMode === 'CLOUD';
}

export function workspaceUrl(slug: string, config: DeploymentConfig) {
  const url = new URL(config.rootDomain);
  if (config.multiWorkspace)
    url.hostname = `${slug}.${url.hostname}`;
  return url.origin;
}

export function assertDeploymentConfig(config: DeploymentConfig & { sessionCookieDomain?: string }) {
  if (config.deploymentMode !== 'CLOUD' && config.deploymentMode !== 'SELF_HOSTED')
    throw new Error('Missing or invalid NUXT_DEPLOYMENT_MODE (must be CLOUD or SELF_HOSTED)');

  let host: string;
  try {
    const url = new URL(config.rootDomain);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('bad protocol');
    host = url.hostname;
  }
  catch {
    throw new Error('Missing or invalid NUXT_ROOT_DOMAIN (must be a valid http(s) URL)');
  }

  // A wildcard certificate and wildcard DNS need a real name. localhost is the
  // one exception, because *.localhost resolves on a development machine.
  if (config.multiWorkspace && (IP_HOST.test(host) || (!host.includes('.') && host !== 'localhost')))
    throw new Error(`NUXT_ROOT_DOMAIN "${host}" cannot hold a wildcard subdomain; set NUXT_MULTI_WORKSPACE=false`);

  // A session sealed for one subdomain does not reach another. Without the
  // parent domain on the cookie, every workspace would ask the user to sign in
  // again, so the boot refuses rather than fail quietly at run time.
  if (config.multiWorkspace && !config.sessionCookieDomain) {
    throw new Error(`NUXT_MULTI_WORKSPACE is true, so NUXT_SESSION_COOKIE_DOMAIN must be set (for example ".${host}")`);
  }
}
