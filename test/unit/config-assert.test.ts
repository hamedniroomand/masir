import { describe, expect, it } from 'vitest';
import { assertRuntimeConfig } from '../../server/utils/config-assert';

describe('assertRuntimeConfig', () => {
  it('throws for short session password', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: 'short',
      databaseUrl: 'file:./data/x.db',
      public: { shortDomain: 'http://localhost:3000' },
    })).toThrow(/NUXT_SESSION_PASSWORD/);
  });
});
