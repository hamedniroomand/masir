import type { Subprocess } from 'bun';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import process from 'node:process';
import { TEST_OUTPUT_DIR } from '../global-setup';

const READY_TIMEOUT_MS = 30_000;

const servers: Subprocess[] = [];

async function freePort() {
  const probe = createServer();
  await new Promise<void>(done => probe.listen(0, '127.0.0.1', () => done()));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>(done => probe.close(() => done()));
  return port;
}

// Without this the server keeps its reason to stop in an unread pipe.
async function serverOutput(server: Subprocess) {
  const [out, err] = await Promise.all([
    new Response(server.stdout as ReadableStream).text(),
    new Response(server.stderr as ReadableStream).text(),
  ]);
  return `${err}${out}`.trim();
}

async function waitForReady(url: string, server: Subprocess) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode != null)
      throw new Error(`test server stopped with code ${server.exitCode}\n${await serverOutput(server)}`);
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok)
        return;
    }
    catch {
      // The server is not listening yet.
    }
    await Bun.sleep(100);
  }
  throw new Error(`test server was not ready in ${READY_TIMEOUT_MS}ms\n${await serverOutput(server)}`);
}

// The app needs the bun runtime for bun:sql, and test-utils starts a server with
// node. So this starts the server and setup() only gets the host.
export async function startTestServer(env: Record<string, string>) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = Bun.spawn(['bun', resolve(TEST_OUTPUT_DIR, 'server/index.mjs')], {
    env: { ...process.env, ...env, PORT: String(port), NODE_ENV: 'production' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  servers.push(server);
  await waitForReady(url, server);
  return url;
}

export async function stopTestServers() {
  await Promise.all(servers.map(async (server) => {
    server.kill();
    await server.exited;
  }));
  servers.length = 0;
}
