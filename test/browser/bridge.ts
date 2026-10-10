// Playwright runs on Node, and the test database helpers need Bun (bun:sql).
// This is the bridge: `bun test/browser/bridge.ts <command> <json>` prints one
// JSON line. Playwright fixtures call it in place of importing the helpers.
import process from 'node:process';
import { count, desc, eq } from 'drizzle-orm';
import { setMemoisedDb } from '#server/database/client';
import { authIdentities, clickEvents, hosts, mailOutbox, workspaceMembers } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { setLinkTags } from '#server/utils/tag-repo';
import { BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import { insertTestCampaign, insertTestLink, insertTestUser, insertTestWorkspace, resetTestDb } from '../e2e/helpers';
import { closeTestDatabases, createTestDatabase, openTestDatabase } from '../e2e/test-db';

type Input = Record<string, unknown> & { url: string };

type LinkInput = {
  workspaceId: string;
  slug: string;
  createdBy?: string;
  title?: string;
  destinationUrl?: string;
  startsAt?: string;
  expiresAt?: string;
  isEnabled?: boolean;
  password?: string;
  maximumVisits?: number;
  expirationDestination?: string;
  clickCount?: number;
  campaignId?: string;
  utmSource?: string;
  tags?: string[];
};

async function linkValues(raw: Record<string, unknown>) {
  const input = raw as LinkInput;
  return {
    workspaceId: input.workspaceId,
    slug: input.slug,
    createdBy: input.createdBy,
    title: input.title,
    destinationUrl: input.destinationUrl,
    startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    isEnabled: input.isEnabled,
    passwordHash: input.password ? await hashSecret(input.password) : undefined,
    maximumVisits: input.maximumVisits ?? undefined,
    expirationDestination: input.expirationDestination ?? undefined,
    clickCount: input.clickCount,
    campaignId: input.campaignId ?? undefined,
    utmSource: input.utmSource ?? undefined,
  };
}

async function seedLink(url: string, raw: Record<string, unknown>) {
  const id = await insertTestLink(url, await linkValues(raw));
  const { tags, workspaceId } = raw as LinkInput;
  if (tags?.length) {
    // setLinkTags reads the server database through getDb, which needs a Nitro
    // runtime config. Point that memo at the test database instead.
    setMemoisedDb(openTestDatabase(url) as Parameters<typeof setMemoisedDb>[0]);
    await setLinkTags(id, workspaceId, tags);
  }
  return id;
}

// A referrer lives in its own table, so a seeded click must name the row.
async function referrerId(url: string, host?: string) {
  if (!host)
    return null;
  const db = openTestDatabase(url);
  const rows = await db.insert(hosts).values({ host }).onConflictDoNothing().returning();
  if (rows[0])
    return rows[0].id;
  const found = await db.select().from(hosts).where(eq(hosts.host, host)).limit(1);
  return found[0]?.id ?? null;
}

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
  'insert-link': async ({ url, ...input }) => seedLink(url, input),
  // One process for many rows. A page of 20 links costs 21 bridge calls otherwise.
  'insert-links': async ({ url, slugs, ...input }) => {
    const ids: string[] = [];
    for (const slug of slugs as string[])
      ids.push(await seedLink(url, { ...input, slug }));
    return ids;
  },
  'insert-campaign': async ({ url, workspaceId, name, utmCampaign }) =>
    insertTestCampaign(url, { workspaceId: String(workspaceId), name: name ? String(name) : undefined, utmCampaign: String(utmCampaign) }),
  'insert-member': async ({ url, workspaceId, userId, role, deactivated }) => {
    const db = openTestDatabase(url);
    await db.insert(workspaceMembers).values({
      workspaceId: String(workspaceId),
      userId: String(userId),
      role: role === 'owner' || role === 'viewer' ? role : 'member',
      deactivatedAt: deactivated ? new Date() : null,
    });
    return { ok: true };
  },
  // Only an OAuth round trip adds a second sign-in method, and no test can make
  // one, so a test that needs two identities seeds the row.
  'insert-identity': async ({ url, userId, provider }) => {
    const db = openTestDatabase(url);
    await db.insert(authIdentities).values({
      userId: String(userId),
      provider: (provider ?? 'google') as 'password' | 'google' | 'microsoft',
      providerAccountId: `${provider ?? 'google'}-${userId}`,
    });
    return { ok: true };
  },
  // The redirect writes these rows. A test that only reads the analytics page
  // seeds them instead of driving hundreds of redirects.
  'insert-clicks': async ({ url, workspaceId, linkId, count: howMany, outcome, device, browser, country, referrer, visitor, minutesAgo }) => {
    const db = openTestDatabase(url);
    const host = await referrerId(url, referrer as string | undefined);
    const outcomeCode = OUTCOME[(outcome ?? 'redirect_success') as keyof typeof OUTCOME];
    const createdAt = new Date(Date.now() - Number(minutesAgo ?? 1) * 60_000);
    // One call is one visitor. Two visitors take two calls, which is what a test
    // that counts unique visitors needs.
    const rows = Array.from({ length: Number(howMany ?? 1) }, () => ({
      workspaceId: String(workspaceId),
      linkId: String(linkId),
      createdAt,
      visitorHash: BigInt(Number(visitor ?? 1)),
      referrerHost: host,
      outcome: outcomeCode,
      device: DEVICE[(device ?? 'desktop') as keyof typeof DEVICE],
      browser: BROWSER[(browser ?? 'chrome') as keyof typeof BROWSER],
      botCategory: null,
      country: (country as string | undefined) ?? null,
      isBot: outcomeCode === OUTCOME.bot_request,
    }));
    await db.insert(clickEvents).values(rows);
    return { ok: true };
  },
  'last-token': async ({ url, to }) => {
    const db = openTestDatabase(url);
    const rows = await db.select().from(mailOutbox).where(eq(mailOutbox.to, String(to))).orderBy(desc(mailOutbox.createdAt)).limit(1);
    return rows[0]?.text.match(/token=([\w-]+)/)?.[1] ?? null;
  },
  'mail-count': async ({ url, to }) => {
    const db = openTestDatabase(url);
    const rows = await db.select({ n: count() }).from(mailOutbox).where(eq(mailOutbox.to, String(to)));
    return Number(rows[0]?.n ?? 0);
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
