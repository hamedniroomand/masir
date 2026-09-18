import type { DeploymentConfig } from '#shared/deployment';
import { describe, expect, it } from 'vitest';
import { assertDeploymentConfig, isCloud, workspaceUrl } from '#shared/deployment';

function config(over: Partial<DeploymentConfig & { sessionCookieDomain: string }> = {}) {
  return {
    deploymentMode: 'CLOUD',
    rootDomain: 'https://masir.dev',
    multiWorkspace: true,
    allowRegistration: true,
    sessionCookieDomain: '.masir.dev',
    ...over,
  };
}

describe('isCloud', () => {
  it('is true only for cloud', () => {
    expect(isCloud(config())).toBe(true);
    expect(isCloud(config({ deploymentMode: 'SELF_HOSTED' }))).toBe(false);
  });
});

describe('workspaceUrl', () => {
  it('adds the slug as a subdomain in multi mode', () => {
    expect(workspaceUrl('acme', config())).toBe('https://acme.masir.dev');
  });

  it('keeps the port and protocol', () => {
    const c = config({ rootDomain: 'http://localhost:3000' });
    expect(workspaceUrl('acme', c)).toBe('http://acme.localhost:3000');
  });

  it('returns the root origin in single mode', () => {
    const c = config({ multiWorkspace: false });
    expect(workspaceUrl('acme', c)).toBe('https://masir.dev');
  });

  it('drops a trailing slash', () => {
    const c = config({ rootDomain: 'https://masir.dev/' });
    expect(workspaceUrl('acme', c)).toBe('https://acme.masir.dev');
  });
});

describe('assertDeploymentConfig', () => {
  it('accepts a valid cloud config', () => {
    expect(() => assertDeploymentConfig(config())).not.toThrow();
  });

  it('rejects a bad mode', () => {
    const c = config({ deploymentMode: 'OTHER' as DeploymentConfig['deploymentMode'] });
    expect(() => assertDeploymentConfig(c)).toThrow(/NUXT_DEPLOYMENT_MODE/);
  });

  it('rejects a root domain that is not an http url', () => {
    expect(() => assertDeploymentConfig(config({ rootDomain: 'masir.dev' })))
      .toThrow(/NUXT_ROOT_DOMAIN/);
  });

  it('rejects an IP root domain in multi mode', () => {
    const c = config({ rootDomain: 'http://192.168.1.10:3000' });
    expect(() => assertDeploymentConfig(c)).toThrow(/wildcard/i);
  });

  it('rejects localhost in multi mode', () => {
    const c = config({ rootDomain: 'http://localhost:3000', sessionCookieDomain: '.localhost' });
    expect(() => assertDeploymentConfig(c)).toThrow(/hostname with a dot/);
  });

  it('accepts localhost in single mode', () => {
    const c = config({ rootDomain: 'http://localhost:3000', multiWorkspace: false });
    expect(() => assertDeploymentConfig(c)).not.toThrow();
  });

  it('accepts an IP root domain in single mode', () => {
    const c = config({ rootDomain: 'http://192.168.1.10:3000', multiWorkspace: false });
    expect(() => assertDeploymentConfig(c)).not.toThrow();
  });

  it('demands a session cookie domain in multi mode', () => {
    expect(() => assertDeploymentConfig({ ...config(), sessionCookieDomain: '' }))
      .toThrow(/NUXT_SESSION_COOKIE_DOMAIN/);
    expect(() => assertDeploymentConfig({ ...config(), sessionCookieDomain: '.masir.dev' }))
      .not
      .toThrow();
  });

  it('does not demand one in single mode', () => {
    expect(() => assertDeploymentConfig({ ...config({ multiWorkspace: false }), sessionCookieDomain: '' }))
      .not
      .toThrow();
  });
});
