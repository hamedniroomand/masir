import type { DeploymentConfig } from '#shared/deployment';
import { assertDeploymentConfig } from '#shared/deployment';

export function assertRuntimeConfig(config: DeploymentConfig & {
  sessionPassword: string;
  databaseUrl: string;
  oauth?: { microsoft?: { clientId?: string; tenant?: string } };
  public: { shortDomain: string };
}) {
  if (!config.sessionPassword || config.sessionPassword.length < 32)
    throw new Error('Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)');

  if (!/^postgres(?:ql)?:\/\//.test(config.databaseUrl ?? ''))
    throw new Error('Missing or invalid NUXT_DATABASE_URL (must be a postgres:// connection string)');

  assertDeploymentConfig({ ...config, sessionCookieDomain: (config as { session?: { cookie?: { domain?: string } } }).session?.cookie?.domain });

  // 'common' accepts every Microsoft tenant in the world, and an identity from
  // any of them links onto a matching local account. A cloud deployment names
  // the tenant it trusts.
  const microsoft = config.oauth?.microsoft;
  if (config.deploymentMode === 'CLOUD' && microsoft?.clientId && (!microsoft.tenant || microsoft.tenant === 'common')) {
    throw new Error('NUXT_OAUTH_MICROSOFT_TENANT must name a tenant in CLOUD mode; "common" accepts every tenant');
  }

  try {
    const url = new URL(config.public.shortDomain);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('bad protocol');
  }
  catch {
    throw new Error('Missing or invalid NUXT_PUBLIC_SHORT_DOMAIN (must be a valid http(s) URL)');
  }
}
