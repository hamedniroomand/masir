export type DeploymentConfig = {
  rootDomain: string;
};

// The one origin that serves sign-in, the dashboard, and the short links.
export function appUrl(config: DeploymentConfig) {
  return new URL(config.rootDomain).origin;
}

export function assertDeploymentConfig(config: DeploymentConfig) {
  try {
    const url = new URL(config.rootDomain);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('bad protocol');
  }
  catch {
    throw new Error('Missing or invalid NUXT_ROOT_DOMAIN (must be a valid http(s) URL)');
  }
}
