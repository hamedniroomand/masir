import { $fetch, setup } from '@nuxt/test-utils';
import { describe, expect, it } from 'vitest';
import { e2eSetupOptions, testDatabaseUrl } from './helpers';

const TEST_DB = testDatabaseUrl('jobs-route');

// A deployment that never set a secret must not admit the route exists.
describe('jobs route without a secret', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  it('answers 404', async () => {
    await expect($fetch('/api/jobs/alerts', { method: 'POST' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
