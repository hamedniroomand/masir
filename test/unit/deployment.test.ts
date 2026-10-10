import { describe, expect, it } from 'vitest';
import { appUrl, assertDeploymentConfig } from '#shared/deployment';

describe('appUrl', () => {
  it('returns the origin of the root domain', () => {
    expect(appUrl({ rootDomain: 'https://go.example.com/' })).toBe('https://go.example.com');
  });

  it('keeps the port', () => {
    expect(appUrl({ rootDomain: 'http://localhost:3000' })).toBe('http://localhost:3000');
  });
});

describe('assertDeploymentConfig', () => {
  it('accepts an http or https origin', () => {
    expect(() => assertDeploymentConfig({ rootDomain: 'https://go.example.com' })).not.toThrow();
    expect(() => assertDeploymentConfig({ rootDomain: 'http://127.0.0.1:3000' })).not.toThrow();
  });

  it('refuses a value that is not an http(s) URL', () => {
    expect(() => assertDeploymentConfig({ rootDomain: 'ftp://go.example.com' })).toThrow(/NUXT_ROOT_DOMAIN/);
    expect(() => assertDeploymentConfig({ rootDomain: 'nope' })).toThrow(/NUXT_ROOT_DOMAIN/);
  });
});
