import { afterAll } from 'vitest';
import { closeTestDatabases } from './e2e/test-db';
import { stopTestServers } from './e2e/test-server';

// An open client or server keeps vitest alive after the last test.
afterAll(async () => {
  await stopTestServers();
  await closeTestDatabases();
});
