import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Every e2e file starts a server from this one build.
export const TEST_OUTPUT_DIR = resolve(root, '.output');

export default function build() {
  // Always build. A kept build can be stale, and a stale build fails quietly.
  const result = spawnSync('bun', ['run', 'build'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0)
    throw new Error(`test build failed\n${result.stderr ?? ''}${result.stdout ?? ''}`);
}
