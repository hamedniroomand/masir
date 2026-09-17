import type { Subprocess } from 'bun';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import process from 'node:process';
import { TEST_OUTPUT_DIR } from '../global-setup';

const READY_TIMEOUT_MS = 30_000;
const PORT_ATTEMPTS = 5;

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

// Bun loads the repository .env into every process it starts, this one and
// the server below. A developer with NUXT_MULTI_WORKSPACE=true in .env would
// otherwise hand it to every test server. Only the values in `env` may reach
// the server, so both leaks are closed here.
function serverEnv(env: Record<string, string>, port: number) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NUXT_')));
  return { ...inherited, ...env, PORT: String(port), NODE_ENV: 'production' };
}

// The app needs the bun runtime for bun:sql, and test-utils starts a server with
// node. So this starts the server and setup() only gets the host.
//
// freePort closes the probe socket before the server binds it. Test files run
// together, so another file can take that port in between. Retry on the clash.
export async function startTestServer(env: Record<string, string>, attempt = 1): Promise<string> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = Bun.spawn(['bun', '--env-file=/dev/null', resolve(TEST_OUTPUT_DIR, 'server/index.mjs')], {
    env: serverEnv(env, port),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  servers.push(server);

  try {
    await waitForReady(url, server);
  }
  catch (error) {
    if (attempt < PORT_ATTEMPTS && String(error).includes('EADDRINUSE'))
      return startTestServer(env, attempt + 1);
    throw error;
  }
  return url;
}

export async function stopTestServers() {
  await Promise.all(servers.map(async (server) => {
    server.kill();
    await server.exited;
  }));
  servers.length = 0;
}
