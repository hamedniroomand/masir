import type { User, Workspace } from '#server/database/schema';
import { randomBytes } from 'node:crypto';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { ensureClickEventPartitions } from '#server/database/migrate';
import { clickEvents, links, users, workspaceMembers, workspaces } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { BOT_CATEGORY, BROWSER, DEVICE, OUTCOME } from '#shared/codes';

export const DEMO_LIFETIME_MS = 24 * 3_600_000;
// A total, not an allowance. The 4 seeded links count, so the visitor adds 5.
export const DEMO_LINK_CAP = 9;
export const DEMO_CREATES_PER_HOUR = 3;
// Reserved by RFC 2606. It never resolves, so no mail can leave for it.
export const DEMO_EMAIL_DOMAIN = 'demo.invalid';

const DAY_MS = 86_400_000;
const SEED_DAYS = 7;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 8;

export const SEED_LINKS = [
  { slug: 'install', title: 'Install guide', destinationUrl: 'https://hamedniroomand.github.io/masir/guide/installation', humanClicks: 120 },
  { slug: 'features', title: 'Feature tour', destinationUrl: 'https://hamedniroomand.github.io/masir/features/', humanClicks: 90 },
  { slug: 'analytics', title: 'Analytics docs', destinationUrl: 'https://hamedniroomand.github.io/masir/features/analytics', humanClicks: 60 },
  { slug: 'source', title: 'Source on GitHub', destinationUrl: 'https://github.com/hamedniroomand/masir', humanClicks: 30 },
] as const;

const DEVICES = [DEVICE.desktop, DEVICE.desktop, DEVICE.mobile, DEVICE.mobile, DEVICE.tablet];
const BROWSERS = [BROWSER.chrome, BROWSER.chrome, BROWSER.safari, BROWSER.firefox, BROWSER.edge];
const COUNTRIES = ['US', 'DE', 'GB', 'NL', 'IR', 'FR', 'CA'];

function randomId() {
  return Array.from(randomBytes(ID_LENGTH), byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

// A fixed sequence, so every demo shows the same charts and a test can count
// on the shape.
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function pick<TItem>(items: readonly TItem[], random: () => number): TItem {
  return items[Math.floor(random() * items.length)] as TItem;
}

function seedEvents(workspaceId: string, linkId: string, humanClicks: number, now: number, random: () => number) {
  const bots = Math.floor(humanClicks / 10);
  return Array.from({ length: humanClicks + bots }, (_, index) => {
    const isBot = index < bots;
    const spread = random();
    // Squared, so most clicks land in the last two days and the chart climbs.
    const age = spread * spread * SEED_DAYS * DAY_MS;
    return {
      workspaceId,
      linkId,
      createdAt: new Date(now - age),
      outcome: isBot ? OUTCOME.bot_request : OUTCOME.redirect_success,
      device: pick(DEVICES, random),
      browser: pick(BROWSERS, random),
      country: pick(COUNTRIES, random),
      isBot,
      botCategory: isBot ? BOT_CATEGORY.monitoring : null,
    };
  });
}

export async function createDemoWorkspace(): Promise<{ user: User; workspace: Workspace }> {
  const db = await getDb();
  const id = randomId();
  const now = Date.now();
  // Boot makes this month and the next. Only a seed that reaches back over a
  // month boundary needs one more, and a second demo racing this one loses
  // harmlessly: the insert below is what actually needs the partition.
  const seedStart = new Date(now - SEED_DAYS * DAY_MS);
  if (seedStart.getUTCMonth() !== new Date(now).getUTCMonth())
    await ensureClickEventPartitions(db, seedStart).catch(() => {});

  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email: `demo-${id}@${DEMO_EMAIL_DOMAIN}`,
      emailVerifiedAt: new Date(now),
      firstName: 'Demo',
    }).returning();
    const [workspace] = await tx.insert(workspaces).values({
      slug: `demo-${id}`,
      name: 'Demo workspace',
      expiresAt: new Date(now + DEMO_LIFETIME_MS),
    }).returning();
    if (!user || !workspace)
      throw new Error('The demo rows vanished between their insert and their read.');

    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: 'owner' });

    const random = sequence(1);
    for (const seed of SEED_LINKS) {
      const [link] = await tx.insert(links).values({
        workspaceId: workspace.id,
        createdBy: user.id,
        slug: seed.slug,
        title: seed.title,
        destinationUrl: seed.destinationUrl,
        destinationHost: new URL(seed.destinationUrl).hostname,
        clickCount: seed.humanClicks,
      }).returning({ id: links.id });
      if (!link)
        throw new Error('The demo link vanished between its insert and its read.');
      await tx.insert(clickEvents).values(seedEvents(workspace.id, link.id, seed.humanClicks, now, random));
    }
    return { user, workspace };
  });
}

// Deletes every demo whose time has passed. links, campaigns, tags, aliases,
// members, and audit rows cascade from the workspace. click_events have no
// foreign key by design and age out with their partition.
export async function runDemoSweep(): Promise<number> {
  const db = await getDb();
  const expired = await db.select({ workspaceId: workspaces.id, userId: workspaceMembers.userId })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.role, 'owner')))
    .where(lt(workspaces.expiresAt, new Date()));

  if (!expired.length)
    return 0;

  await db.transaction(async (tx) => {
    await tx.delete(workspaces).where(inArray(workspaces.id, expired.map(row => row.workspaceId)));
    await tx.delete(users).where(inArray(users.id, expired.map(row => row.userId)));
  });
  return expired.length;
}

// Every demo guard answers the same way, so the client can show the reason.
export function demoRefusal(reason: string) {
  return createError({ statusCode: 403, statusMessage: reason, data: { reason } });
}
