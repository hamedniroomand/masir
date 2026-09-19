import type { DeploymentConfig } from '#shared/deployment';
import { assertDeploymentConfig } from '#shared/deployment';

const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]+$/i;
export const MAX_ALERTS_INTERVAL_MINUTES = 35_000;

export function assertRuntimeConfig(config: DeploymentConfig & {
  sessionPassword: string;
  databaseUrl: string;
  alertsIntervalMinutes?: number | string;
  demoEnabled?: boolean | string;
  session?: { cookie?: { domain?: string } };
  oauth?: { microsoft?: { clientId?: string; tenant?: string } };
  public: {
    shortDomain: string;
    scripts?: { googleAnalytics?: { id?: string } };
    sentry?: { dsn?: string; tracesSampleRate?: number | string };
  };
}) {
  if (!config.sessionPassword || config.sessionPassword.length < 32)
    throw new Error('Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)');

  if (!/^postgres(?:ql)?:\/\//.test(config.databaseUrl ?? ''))
    throw new Error('Missing or invalid NUXT_DATABASE_URL (must be a postgres:// connection string)');

  assertDeploymentConfig({ ...config, sessionCookieDomain: config.session?.cookie?.domain });

  // A demo makes one workspace for each visitor. Single mode has one
  // workspace and no place to put another.
  if (config.demoEnabled && !config.multiWorkspace)
    throw new Error('NUXT_DEMO_ENABLED is true, so NUXT_MULTI_WORKSPACE must be true');

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

  // setInterval takes a 32-bit signed delay in milliseconds. Above that it
  // fires every millisecond, so the ceiling stays under it.
  const interval = Number(config.alertsIntervalMinutes ?? 15);
  if (!Number.isInteger(interval) || interval < 0 || interval > MAX_ALERTS_INTERVAL_MINUTES)
    throw new Error(`Missing or invalid NUXT_ALERTS_INTERVAL_MINUTES (must be a whole number of minutes from 0 to ${MAX_ALERTS_INTERVAL_MINUTES}, 0 turns the sweep off)`);

  const googleAnalyticsId = config.public.scripts?.googleAnalytics?.id;
  if (googleAnalyticsId && !GA4_MEASUREMENT_ID.test(googleAnalyticsId))
    throw new Error('Missing or invalid NUXT_PUBLIC_SCRIPTS_GOOGLE_ANALYTICS_ID (must be a GA4 measurement ID, G-XXXXXXXX)');

  const dsn = config.public.sentry?.dsn?.trim();
  if (dsn) {
    try {
      const url = new URL(dsn);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('bad protocol');
    }
    catch {
      throw new Error('Missing or invalid NUXT_PUBLIC_SENTRY_DSN (must be a valid http(s) URL)');
    }
  }

  const sampleRate = config.public.sentry?.tracesSampleRate;
  if (sampleRate != null && sampleRate !== '') {
    const rate = typeof sampleRate === 'number' ? sampleRate : Number(sampleRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1)
      throw new Error('Missing or invalid NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE (must be a number from 0 to 1)');
  }
}
