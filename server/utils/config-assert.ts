import type { DeploymentConfig } from '#shared/deployment';
import { assertDeploymentConfig } from '#shared/deployment';

export function assertRuntimeConfig(config: DeploymentConfig & {
  sessionPassword: string;
  databaseUrl: string;
  public: { shortDomain: string };
}) {
  if (!config.sessionPassword || config.sessionPassword.length < 32)
    throw new Error('Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)');

  if (!/^postgres(?:ql)?:\/\//.test(config.databaseUrl ?? ''))
    throw new Error('Missing or invalid NUXT_DATABASE_URL (must be a postgres:// connection string)');

  assertDeploymentConfig(config);

  try {
    const url = new URL(config.public.shortDomain);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('bad protocol');
  }
  catch {
    throw new Error('Missing or invalid NUXT_PUBLIC_SHORT_DOMAIN (must be a valid http(s) URL)');
  }
}
