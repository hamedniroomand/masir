export type DeploymentMode = 'CLOUD' | 'SELF_HOSTED';

export type DeploymentConfig = {
  deploymentMode: DeploymentMode;
  rootDomain: string;
  // Empty means the app lives on the root domain.
  appDomain?: string;
  multiWorkspace: boolean;
  allowRegistration: boolean;
};

const IP_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$|^\[[\da-f:]+\]$/i;

export function isCloud(config: DeploymentConfig) {
  return config.deploymentMode === 'CLOUD';
}

// Where sign-in, onboarding, and the dashboard live.
export function appUrl(config: DeploymentConfig) {
  return new URL(config.appDomain || config.rootDomain).origin;
}

// Where a short link lives. In multi mode the workspace subdomain serves both
// the app and the links, so this and workspaceUrl only differ in single mode.
export function linkOrigin(slug: string, config: DeploymentConfig) {
  const url = new URL(config.rootDomain);
  if (config.multiWorkspace)
    url.hostname = `${slug}.${url.hostname}`;
  return url.origin;
}

export function workspaceUrl(slug: string, config: DeploymentConfig) {
  return config.multiWorkspace ? linkOrigin(slug, config) : appUrl(config);
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

  // Browsers store a cookie for localhost as host-only and drop Domain=.localhost,
  // so a session set on the root never reaches acme.localhost and every sign-in
  // loops back to the login page. A dotted name has no such rule.
  if (config.multiWorkspace && host === 'localhost')
    throw new Error('NUXT_ROOT_DOMAIN "localhost" cannot share a session cookie with its subdomains; use a hostname with a dot, or set NUXT_MULTI_WORKSPACE=false');

  // A wildcard certificate and wildcard DNS need a real name.
  if (config.multiWorkspace && (IP_HOST.test(host) || !host.includes('.')))
    throw new Error(`NUXT_ROOT_DOMAIN "${host}" cannot hold a wildcard subdomain; set NUXT_MULTI_WORKSPACE=false`);

  if (config.appDomain) {
    let appHost: string;
    try {
      const url = new URL(config.appDomain);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('bad protocol');
      appHost = url.hostname;
    }
    catch {
      throw new Error('Missing or invalid NUXT_APP_DOMAIN (must be a valid http(s) URL, or empty)');
    }
    // The session cookie is scoped to the root domain, so an app host outside
    // it would sign in and never be signed in.
    if (config.multiWorkspace && appHost !== host && !appHost.endsWith(`.${host}`))
      throw new Error(`NUXT_APP_DOMAIN "${appHost}" must be ${host} or a subdomain of it, so the session cookie reaches it`);
  }

  // A session sealed for one subdomain does not reach another. Without the
  // parent domain on the cookie, every workspace would ask the user to sign in
  // again, so the boot refuses rather than fail quietly at run time.
  if (config.multiWorkspace && !config.sessionCookieDomain) {
    throw new Error(`NUXT_MULTI_WORKSPACE is true, so NUXT_SESSION_COOKIE_DOMAIN must be set (for example ".${host}")`);
  }
}
