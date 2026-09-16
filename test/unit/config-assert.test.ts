import { describe, expect, it } from 'vitest';
import { assertRuntimeConfig } from '#server/utils/config-assert';

describe('assertRuntimeConfig', () => {
  it('throws for short session password', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: 'short',
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      public: { shortDomain: 'http://localhost:3000' },
    })).toThrow(/NUXT_SESSION_PASSWORD/);
  });

  it('throws for a non-postgres database url', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'file:./data/x.db',
      public: { shortDomain: 'http://localhost:3000' },
    })).toThrow(/NUXT_DATABASE_URL/);
  });
});
