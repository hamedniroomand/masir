import type { AppDatabase } from '#server/database/client';
import type { OutcomeLabel } from '#shared/codes';
import type { CampaignKey, DemoLink, MemberKey, Weighted } from './demo-data';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { eq, sql } from 'drizzle-orm';
import { openDatabase } from '#server/database/client';
import { ensureClickEventPartitions, runMigrations } from '#server/database/migrate';
import {
  auditEvents,
  authIdentities,
  campaigns,
  clickEvents,
  hosts,
  linkAliases,
  links,
  linkTags,
  tags,
  users,
  workspaceInvitations,
  workspaceMembers,
} from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { BOT_CATEGORY, BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import {
  BOT_SHARE,
  BOTS,
  BROWSERS,
  CAMPAIGNS,
  COUNTRIES,
  DAY,
  daysAgo,
  DEVICES,
  LINKS,
  MEMBERS,
  NOW,
  PENDING_INVITE,
  REFERRERS,
  SOURCE_REFERRER,
  TAGS,
  TEAM_NOTES_PASSWORD,
} from './demo-data';

type Transaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
type AuditRow = typeof auditEvents.$inferInsert;
type ClickRow = typeof clickEvents.$inferInsert;
type CampaignRow = { id: string; utmCampaign: string; utmMedium: string };

const databaseUrl = process.env.NUXT_DATABASE_URL ?? 'postgres://masir:masir@127.0.0.1:5432/masir';
const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
const demoPassword = process.env.DEMO_PASSWORD;

// A fixed seed gives the same demo on each install.
let seed = 2026;
function random() {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
}

function pick<TValue>(weighted: Weighted<TValue>): TValue {
  let roll = random() * weighted.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll <= 0)
      return value;
  }
  return weighted[weighted.length - 1]?.[0] as TValue;
}

function one<TRow>(rows: TRow[]): TRow {
  const [row] = rows;
  if (!row)
    throw new Error('insert returned no row');
  return row;
}

function randomVisitor() {
  const high = BigInt(Math.floor(random() * 2 ** 32));
  const low = BigInt(Math.floor(random() * 2 ** 32));
  return BigInt.asIntN(64, (high << 32n) | low);
}

// Null means no event: a stopped link with no block outcome got no visitors.
function outcomeFor(link: DemoLink, time: number): OutcomeLabel | null {
  if (link.stopped != null && time > NOW - link.stopped * DAY)
    return link.outcomeAfterStop ?? null;
  if (link.slug === 'team-notes' && random() < 0.25)
    return 'password_failed';
  if (link.slug === 'webinar')
    return 'scheduled_redirect';
  return 'redirect_success';
}

function clicksFor(link: DemoLink, ids: { workspaceId: string; linkId: string }, campaign: CampaignRow | undefined, hostIds: Map<string, number>) {
  const created = NOW - link.created * DAY;
  const visitors = Array.from({ length: Math.max(1, link.daily * 6) }, randomVisitor);
  const events: ClickRow[] = [];
  let humanClicks = 0;

  for (let day = link.created; day >= 0; day--) {
    const weekday = daysAgo(day).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.6 : 1;
    const launchWeek = link.campaign === 'launch' && day >= 17 ? 3 : 1;
    const total = Math.round(link.daily * weekend * launchWeek * (0.5 + random()));

    for (let index = 0; index < total; index++) {
      const time = NOW - day * DAY - Math.floor(random() * DAY);
      const isBot = random() < BOT_SHARE;
      const outcome = isBot ? 'bot_request' : outcomeFor(link, time);
      if (time < created || !outcome)
        continue;
      if (outcome === 'redirect_success') {
        if (link.clickCap != null && humanClicks >= link.clickCap)
          continue;
        humanClicks++;
      }

      const referrer = link.utmSource ? SOURCE_REFERRER[link.utmSource] : pick(REFERRERS);
      const attributed = campaign && (outcome === 'redirect_success' || outcome === 'bot_request') ? campaign : null;
      events.push({
        ...ids,
        createdAt: new Date(time),
        visitorHash: outcome === 'redirect_success' ? visitors[Math.floor(random() * visitors.length)] : null,
        referrerHost: referrer ? hostIds.get(referrer) : null,
        outcome: OUTCOME[outcome],
        device: isBot ? DEVICE.other : DEVICE[pick(DEVICES)],
        browser: isBot ? BROWSER.other : BROWSER[pick(BROWSERS)],
        botCategory: isBot ? BOT_CATEGORY[pick(BOTS)] : null,
        country: pick(COUNTRIES),
        isBot,
        campaignId: attributed?.id ?? null,
        attributionVersion: attributed ? 1 : null,
        utmSource: attributed ? link.utmSource : null,
        utmMedium: attributed?.utmMedium ?? null,
        utmCampaign: attributed?.utmCampaign ?? null,
        utmContent: attributed ? link.columns?.utmContent ?? null : null,
      });
    }
  }
  return { events, humanClicks };
}

async function seedMembers(tx: Transaction, workspaceId: string, ownerId: string, audit: AuditRow[]) {
  const userIds = { owner: ownerId } as Record<MemberKey, string>;
  for (const member of MEMBERS) {
    const user = one(await tx.insert(users).values({
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      createdAt: daysAgo(member.joined),
    }).returning({ id: users.id }));
    userIds[member.key] = user.id;
    await tx.insert(workspaceMembers).values({
      workspaceId,
      userId: user.id,
      role: member.role,
      deactivatedAt: member.deactivated == null ? null : daysAgo(member.deactivated),
      createdAt: daysAgo(member.joined),
    });
    audit.push(
      { type: 'invitation_sent', workspaceId, actorId: ownerId, createdAt: daysAgo(member.joined + 1), detail: { email: member.email } },
      { type: 'invitation_accepted', workspaceId, actorId: user.id, createdAt: daysAgo(member.joined), detail: { email: member.email } },
    );
    if (member.deactivated != null)
      audit.push({ type: 'member_activity_changed', workspaceId, actorId: ownerId, createdAt: daysAgo(member.deactivated), detail: { userId: user.id, active: false } });
  }
  audit.push({ type: 'member_role_changed', workspaceId, actorId: ownerId, createdAt: daysAgo(11), detail: { userId: userIds.mia, role: 'VIEWER' } });

  await tx.insert(workspaceInvitations).values({
    workspaceId,
    email: PENDING_INVITE.email,
    tokenHash: randomBytes(32),
    invitedBy: ownerId,
    role: 'member',
    expiresAt: daysAgo(PENDING_INVITE.sent - 7),
    createdAt: daysAgo(PENDING_INVITE.sent),
  });
  audit.push({ type: 'invitation_sent', workspaceId, actorId: ownerId, createdAt: daysAgo(PENDING_INVITE.sent), detail: { email: PENDING_INVITE.email } });
  return userIds;
}

// The account can sign in, but only as a viewer. NUXT_READ_ONLY_EMAILS makes
// it see the owner pages.
async function seedDemoViewer(tx: Transaction, workspaceId: string, email: string, password: string) {
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing)
    return;
  const user = one(await tx.insert(users).values({ email, firstName: 'Demo', lastName: 'Viewer' }).returning({ id: users.id }));
  await tx.insert(authIdentities).values({ userId: user.id, provider: 'password', providerAccountId: user.id, passwordHash: await hashSecret(password) });
  await tx.insert(workspaceMembers).values({ workspaceId, userId: user.id, role: 'viewer' });
}

async function seedCampaigns(tx: Transaction, workspaceId: string, userIds: Record<MemberKey, string>, audit: AuditRow[]) {
  const rows = new Map<CampaignKey, CampaignRow>();
  for (const campaign of CAMPAIGNS) {
    const row = one(await tx.insert(campaigns).values({
      workspaceId,
      createdBy: userIds[campaign.by],
      name: campaign.name,
      utmCampaign: campaign.utmCampaign,
      utmMedium: campaign.utmMedium,
      createdAt: daysAgo(campaign.created),
    }).returning({ id: campaigns.id }));
    rows.set(campaign.key, { id: row.id, utmCampaign: campaign.utmCampaign, utmMedium: campaign.utmMedium });
    audit.push({ type: 'campaign_created', workspaceId, actorId: userIds[campaign.by], createdAt: daysAgo(campaign.created), detail: { name: campaign.name } });
  }
  audit.push({ type: 'campaign_updated', workspaceId, actorId: userIds.sara, createdAt: daysAgo(3), detail: { name: 'October newsletter' } });
  return rows;
}

async function seedHosts(tx: Transaction) {
  const ids = new Map<string, number>();
  for (const host of new Set([...REFERRERS.map(([name]) => name), ...Object.values(SOURCE_REFERRER)])) {
    if (!host)
      continue;
    // do update, not do nothing, so a host that exists still returns its id.
    const row = one(await tx.insert(hosts).values({ host }).onConflictDoUpdate({ target: hosts.host, set: { host: sql`excluded.host` } }).returning({ id: hosts.id }));
    ids.set(host, row.id);
  }
  return ids;
}

// Changes after creation, so the activity log shows more than link_created.
function linkHistory(link: DemoLink, base: AuditRow, userIds: Record<MemberKey, string>): AuditRow[] {
  switch (link.slug) {
    case 'github':
      return [{ ...base, type: 'link_alias_added', actorId: userIds.owner, createdAt: daysAgo(19), detail: { slug: 'gh' } }];
    case 'team-notes':
      return [{ ...base, type: 'link_password_set', detail: {} }];
    case 'docs':
      return [
        { ...base, type: 'link_responsible_changed', actorId: userIds.owner, createdAt: daysAgo(18), detail: { userId: userIds.sara } },
        { ...base, type: 'link_updated', actorId: userIds.sara, createdAt: daysAgo(8), detail: { fields: ['notes'] } },
      ];
    case 'old-promo':
      return [{ ...base, type: 'link_updated', createdAt: daysAgo(link.stopped ?? 0), detail: { fields: ['isEnabled'] } }];
    case 'summer-sale':
      return [{ ...base, type: 'link_archived', createdAt: daysAgo(6), detail: {} }];
    case 'typo-link':
      return [{ ...base, type: 'link_deleted', createdAt: daysAgo(5), detail: {} }];
    default:
      return [];
  }
}

async function seedLinks(tx: Transaction, workspaceId: string, userIds: Record<MemberKey, string>, campaignRows: Map<CampaignKey, CampaignRow>, audit: AuditRow[]) {
  const tagIds = new Map<string, string>();
  for (const name of TAGS) {
    const tag = one(await tx.insert(tags).values({ workspaceId, name, normalizedName: name.toLowerCase(), createdAt: daysAgo(28) }).returning({ id: tags.id }));
    tagIds.set(name, tag.id);
  }
  const hostIds = await seedHosts(tx);
  const events: ClickRow[] = [];

  for (const link of LINKS) {
    const campaign = link.campaign ? campaignRows.get(link.campaign) : undefined;
    const createdAt = daysAgo(link.created);
    const row = one(await tx.insert(links).values({
      workspaceId,
      createdBy: userIds[link.by],
      slug: link.slug,
      title: link.title,
      destinationUrl: link.destinationUrl,
      destinationHost: new URL(link.destinationUrl).host,
      campaignId: campaign?.id ?? null,
      utmSource: link.utmSource ?? null,
      passwordHash: link.slug === 'team-notes' ? await hashSecret(TEAM_NOTES_PASSWORD) : null,
      responsibleUserId: link.slug === 'docs' ? userIds.sara : null,
      createdAt,
      updatedAt: createdAt,
      ...link.columns,
    }).returning({ id: links.id }));

    for (const tag of link.tags)
      await tx.insert(linkTags).values({ workspaceId, linkId: row.id, tagId: tagIds.get(tag) ?? '' });
    if (link.slug === 'github')
      await tx.insert(linkAliases).values({ workspaceId, slug: 'gh', linkId: row.id, createdAt: daysAgo(19) });

    const clicks = clicksFor(link, { workspaceId, linkId: row.id }, campaign, hostIds);
    events.push(...clicks.events);
    await tx.update(links).set({ clickCount: clicks.humanClicks }).where(eq(links.id, row.id));

    const base: AuditRow = { type: 'link_created', workspaceId, actorId: userIds[link.by], linkId: row.id, createdAt, detail: { slug: link.slug } };
    audit.push(base, ...linkHistory(link, base, userIds));
  }

  for (let index = 0; index < events.length; index += 500)
    await tx.insert(clickEvents).values(events.slice(index, index + 500));
  return events.length;
}

if (demoEmail && !demoPassword) {
  console.error('Set DEMO_PASSWORD with DEMO_EMAIL');
  process.exit(1);
}

await runMigrations(databaseUrl);
const db = openDatabase(databaseUrl);

const [owner] = await db.select({ userId: workspaceMembers.userId, workspaceId: workspaceMembers.workspaceId })
  .from(workspaceMembers)
  .where(eq(workspaceMembers.role, 'owner'))
  .limit(1);
if (!owner) {
  console.error('No workspace yet. Run db:seed:admin first.');
  process.exit(1);
}

const [existing] = await db.select({ id: links.id }).from(links).where(eq(links.workspaceId, owner.workspaceId)).limit(1);
if (existing) {
  console.error('The workspace has links already. The demo seed runs only on an empty workspace.');
  process.exit(1);
}

// Boot makes partitions for this month and the next ones only. The demo
// clicks go back a month.
await ensureClickEventPartitions(db, daysAgo(31));

const summary = await db.transaction(async (tx) => {
  const audit: AuditRow[] = [];
  const userIds = await seedMembers(tx, owner.workspaceId, owner.userId, audit);
  if (demoEmail && demoPassword)
    await seedDemoViewer(tx, owner.workspaceId, demoEmail, demoPassword);
  const campaignRows = await seedCampaigns(tx, owner.workspaceId, userIds, audit);
  const clicks = await seedLinks(tx, owner.workspaceId, userIds, campaignRows, audit);

  // The activity log orders by id, so the rows go in by time.
  audit.sort((first, second) => (first.createdAt?.getTime() ?? 0) - (second.createdAt?.getTime() ?? 0));
  await tx.insert(auditEvents).values(audit);
  return `${MEMBERS.length} members, ${LINKS.length} links, ${clicks} clicks, ${audit.length} activity rows`;
});

console.log(`Demo data added: ${summary}.`);
await db.$client.end();
