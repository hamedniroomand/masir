// Playwright runs on Node, and the test database helpers need Bun (bun:sql).
// This is the bridge: `bun test/browser/bridge.ts <command> <json>` prints one
// JSON line. Playwright fixtures call it in place of importing the helpers.
import process from 'node:process';
import { desc, eq } from 'drizzle-orm';
import { mailOutbox } from '#server/database/schema';
import { insertTestLink, insertTestUser, insertTestWorkspace, resetTestDb } from '../e2e/helpers';
import { closeTestDatabases, createTestDatabase, openTestDatabase } from '../e2e/test-db';

type Input = Record<string, string | boolean | undefined> & { url: string };

const commands: Record<string, (input: Input) => Promise<unknown>> = {
  'create-db': async ({ url }) => createTestDatabase(url),
  reset: async ({ url }) => {
    const { userId, workspaceId } = await resetTestDb(url);
    return { userId, workspaceId };
  },
  'insert-user': async ({ url, email, password, verified }) =>
    insertTestUser(url, { email: String(email), password: String(password), verified: verified !== false }),
  'insert-workspace': async ({ url, slug, ownerUserId, name }) =>
    insertTestWorkspace(url, { slug: String(slug), ownerUserId: String(ownerUserId), name: name ? String(name) : undefined }),
  'insert-link': async ({ url, workspaceId, slug, destinationUrl, startsAt }) =>
    insertTestLink(url, {
      workspaceId: String(workspaceId),
      slug: String(slug),
      destinationUrl: destinationUrl ? String(destinationUrl) : undefined,
      startsAt: startsAt ? new Date(String(startsAt)) : undefined,
    }),
  'last-token': async ({ url, to }) => {
    const db = openTestDatabase(url);
    const rows = await db.select().from(mailOutbox).where(eq(mailOutbox.to, String(to))).orderBy(desc(mailOutbox.createdAt)).limit(1);
    return rows[0]?.text.match(/token=([\w-]+)/)?.[1] ?? null;
  },
};

async function main() {
  const [command = '', raw = '{}'] = Bun.argv.slice(2);
  const run = commands[command];
  if (!run) {
    console.error(`unknown bridge command "${command}"; known: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
  }
  const result = await run(JSON.parse(raw));
  await closeTestDatabases();
  process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
}

main();
