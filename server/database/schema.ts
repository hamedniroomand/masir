import type { LinkTargeting } from '#shared/link-targeting';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  bytea,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

function timestampTz(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date' });
}

// Postgres 18 gives uuidv7() natively. The default keeps the id out of the
// application, so every insert reads it back with returning().
const uuidV7 = sql`uuidv7()`;

export const authProviderEnum = pgEnum('auth_provider', ['password', 'google', 'microsoft']);
export const tokenPurposeEnum = pgEnum('token_purpose', ['email_verify', 'password_reset']);
export const workspacePlanEnum = pgEnum('workspace_plan', ['trial', 'active', 'trial_expired']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'member', 'viewer']);

export type AuthProviderLabel = typeof authProviderEnum.enumValues[number];
export type TokenPurpose = typeof tokenPurposeEnum.enumValues[number];
export type WorkspacePlanLabel = typeof workspacePlanEnum.enumValues[number];
export type MemberRoleLabel = typeof memberRoleEnum.enumValues[number];

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(uuidV7),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestampTz('email_verified_at'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  // Every sealed session carries this number. Raising it refuses every session
  // that a password change or a sign-out-everywhere should end.
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: timestampTz('last_login_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  check('users_email_lower_check', sql`${table.email} = lower(${table.email})`),
]);

export const authIdentities = pgTable('auth_identities', {
  id: uuid('id').primaryKey().default(uuidV7),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: authProviderEnum('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  uniqueIndex('auth_identities_provider_account_unique_idx').on(table.provider, table.providerAccountId),
  index('auth_identities_user_id_idx').on(table.userId),
  check(
    'auth_identities_password_hash_check',
    sql`(${table.provider} = 'password') = (${table.passwordHash} is not null)`,
  ),
]);

// One table for every single-use token. The purpose column keeps the lifetimes
// and the call sites apart.
export const userTokens = pgTable('user_tokens', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: tokenPurposeEnum('purpose').notNull(),
  tokenHash: bytea('token_hash').notNull().unique(),
  expiresAt: timestampTz('expires_at').notNull(),
  consumedAt: timestampTz('consumed_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  index('user_tokens_user_purpose_idx').on(table.userId, table.purpose),
  index('user_tokens_expires_at_idx').on(table.expiresAt),
]);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(uuidV7),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  plan: workspacePlanEnum('plan').notNull().default('active'),
  trialStartedAt: timestampTz('trial_started_at'),
  trialEndsAt: timestampTz('trial_ends_at'),
  subscriptionStatus: text('subscription_status'),
  // A deleted workspace keeps its slug. A subdomain must never change hands
  // without an operator action.
  deletedAt: timestampTz('deleted_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  check('workspaces_slug_format_check', sql`${table.slug} ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'`),
]);

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull(),
  deactivatedAt: timestampTz('deactivated_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  index('workspace_members_user_id_idx').on(table.userId),
  // One owner for each workspace. The database refuses a second one even when
  // application code slips.
  uniqueIndex('workspace_members_one_owner_idx')
    .on(table.workspaceId)
    .where(sql`role = 'owner'`),
]);

// A null role means member, which keeps every invitation made before the role
// column working. A workspace holds one owner, and only transfer changes who
// that is, so an invitation never carries the owner role.
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().default(uuidV7),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tokenHash: bytea('token_hash').notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  role: memberRoleEnum('role'),
  expiresAt: timestampTz('expires_at').notNull(),
  acceptedAt: timestampTz('accepted_at'),
  revokedAt: timestampTz('revoked_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  index('workspace_invitations_workspace_id_idx').on(table.workspaceId),
  uniqueIndex('workspace_invitations_open_idx')
    .on(table.workspaceId, table.email)
    .where(sql`accepted_at is null and revoked_at is null`),
  check('workspace_invitations_email_lower_check', sql`${table.email} = lower(${table.email})`),
]);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().default(uuidV7),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  utmCampaign: text('utm_campaign').notNull(),
  utmMedium: text('utm_medium'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  uniqueIndex('campaigns_workspace_utm_campaign_unique_idx').on(table.workspaceId, table.utmCampaign),
  index('campaigns_workspace_created_idx').on(table.workspaceId, table.createdAt.desc()),
]);

export const links = pgTable('links', {
  id: uuid('id').primaryKey().default(uuidV7),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  title: text('title'),
  // Private to the workspace. The valibot schema caps the length.
  notes: text('notes'),
  destinationUrl: text('destination_url').notNull(),
  destinationHost: text('destination_host').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  startsAt: timestampTz('starts_at'),
  expiresAt: timestampTz('expires_at'),
  expirationDestination: text('expiration_destination'),
  limitDestination: text('limit_destination'),
  scheduledDestination: text('scheduled_destination'),
  targeting: jsonb('targeting').$type<LinkTargeting>(),
  passwordHash: text('password_hash'),
  maximumVisits: bigint('maximum_visits', { mode: 'number' }),
  // One counter. It totals the successful human redirects and it is the number
  // the visit limit compares against.
  clickCount: bigint('click_count', { mode: 'number' }).notNull().default(0),
  utmSource: text('utm_source'),
  utmCampaign: text('utm_campaign'),
  utmTerm: text('utm_term'),
  utmContent: text('utm_content'),
  // A deleted link keeps its slug and its click history. Soft delete replaces
  // the reserved slug table.
  deletedAt: timestampTz('deleted_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  updatedAt: timestampTz('updated_at').notNull().defaultNow(),
}, table => [
  uniqueIndex('links_workspace_slug_unique_idx').on(table.workspaceId, table.slug),
  index('links_workspace_created_idx').on(table.workspaceId, table.createdAt.desc()).where(sql`deleted_at is null`),
  index('links_workspace_clicks_idx').on(table.workspaceId, table.clickCount.desc()).where(sql`deleted_at is null`),
  index('links_campaign_idx').on(table.campaignId).where(sql`deleted_at is null`),
  check('links_slug_format_check', sql`${table.slug} ~ '^[a-z0-9_-]{1,64}$'`),
  check('links_maximum_visits_check', sql`${table.maximumVisits} > 0`),
  check('links_click_count_check', sql`${table.clickCount} >= 0`),
  check(
    'links_schedule_check',
    sql`${table.startsAt} is null or ${table.expiresAt} is null or ${table.startsAt} < ${table.expiresAt}`,
  ),
  // A campaign owns utm_campaign. A link carries its own only without one.
  check('links_campaign_utm_check', sql`${table.campaignId} is null or ${table.utmCampaign} is null`),
]);

// A renamed or extra address for a link. The row stays after a delete, so the
// slug never returns to the pool and an old QR code never points somewhere new.
export const linkAliases = pgTable('link_aliases', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  linkId: uuid('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  // Removing an alias stops it resolving. The row stays, so the slug never
  // returns to the pool and nobody else can claim an address that once worked.
  revokedAt: timestampTz('revoked_at'),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.workspaceId, table.slug] }),
  index('link_aliases_link_id_idx').on(table.linkId),
  check('link_aliases_slug_format_check', sql`${table.slug} ~ '^[a-z0-9_-]{1,64}$'`),
]);

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().default(uuidV7),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
}, table => [
  uniqueIndex('tags_workspace_normalized_name_unique_idx').on(table.workspaceId, table.normalizedName),
]);

export const linkTags = pgTable('link_tags', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  linkId: uuid('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, table => [
  primaryKey({ columns: [table.linkId, table.tagId] }),
  index('link_tags_tag_id_idx').on(table.tagId),
]);

// referrer_host repeats a few hundred values across millions of event rows.
export const hosts = pgTable('hosts', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  host: text('host').notNull().unique(),
});

// No foreign key to links or workspaces. An event log must never block or
// cascade a delete. Rows age out with their partition.
// Column order follows alignment: 8 bytes, then 4, 2, 1, then variable.
export const clickEvents = pgTable('click_events', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  visitorHash: bigint('visitor_hash', { mode: 'bigint' }),
  workspaceId: uuid('workspace_id').notNull(),
  linkId: uuid('link_id').notNull(),
  referrerHost: integer('referrer_host').references(() => hosts.id),
  outcome: smallint('outcome').notNull(),
  device: smallint('device').notNull(),
  browser: smallint('browser').notNull(),
  botCategory: smallint('bot_category'),
  country: char('country', { length: 2 }),
  isBot: boolean('is_bot').notNull(),
}, table => [
  primaryKey({ columns: [table.createdAt, table.id] }),
  index('click_events_link_created_idx').on(table.linkId, table.createdAt),
  index('click_events_workspace_created_idx').on(table.workspaceId, table.createdAt),
]);

// No reader yet. The table ships with the first tag so the hourly rollup can
// land later as a minor without a schema change.
export const linkDailyStats = pgTable('link_daily_stats', {
  linkId: uuid('link_id').notNull(),
  day: date('day').notNull(),
  humanClicks: integer('human_clicks').notNull().default(0),
  botRequests: integer('bot_requests').notNull().default(0),
}, table => [
  primaryKey({ columns: [table.linkId, table.day] }),
]);

// workspaceId is nullable because a sign-in failure happens before any
// workspace is known. A null row is operator-only and never reaches the
// workspace UI, which filters on a concrete workspace.
export const auditEvents = pgTable('audit_events', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  linkId: uuid('link_id'),
  // text, not an enum. About 30 labels grow over time and an enum would need an
  // alter type for each one.
  type: text('type').notNull(),
  detail: jsonb('detail'),
}, table => [
  index('audit_events_workspace_created_idx').on(table.workspaceId, table.createdAt.desc()),
  index('audit_events_link_created_idx').on(table.linkId, table.createdAt.desc()).where(sql`link_id is not null`),
]);

// Only a test configuration writes this. It lets a test read a message that
// the server process sent, because the server runs in its own process.
export const mailOutbox = pgTable('mail_outbox', {
  id: uuid('id').primaryKey().default(uuidV7),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  createdAt: timestampTz('created_at').notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthIdentity = typeof authIdentities.$inferSelect;
export type UserToken = typeof userTokens.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type ResolvedLink = Link & { utmMedium: string | null; utmCampaign: string | null };
export type ClickEvent = typeof clickEvents.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
