import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

function timestampTz(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date' });
}

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestampTz('email_verified_at'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  // Every sealed session carries this number. Raising it refuses every session
  // that a password change or a sign-out-everywhere should end.
  sessionVersion: integer('session_version').notNull().default(0),
  createdAt: timestampTz('created_at').notNull(),
  updatedAt: timestampTz('updated_at').notNull(),
  lastLoginAt: timestampTz('last_login_at'),
});

export const workspacePlans = ['TRIAL', 'ACTIVE', 'TRIAL_EXPIRED'] as const;
export const workspaceRoles = ['OWNER', 'MEMBER'] as const;

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logoUrl: text('logo_url'),
  plan: text('plan', { enum: workspacePlans }).notNull().default('TRIAL'),
  trialStartedAt: timestampTz('trial_started_at'),
  trialEndsAt: timestampTz('trial_ends_at'),
  subscriptionStatus: text('subscription_status'),
  deletedAt: timestampTz('deleted_at'),
  createdAt: timestampTz('created_at').notNull(),
  updatedAt: timestampTz('updated_at').notNull(),
}, table => [
  uniqueIndex('workspaces_slug_unique_idx').on(table.slug),
]);

export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: workspaceRoles }).notNull(),
  deactivatedAt: timestampTz('deactivated_at'),
  createdAt: timestampTz('created_at').notNull(),
  updatedAt: timestampTz('updated_at').notNull(),
}, table => [
  uniqueIndex('workspace_members_workspace_user_unique_idx').on(table.workspaceId, table.userId),
  index('workspace_members_user_id_idx').on(table.userId),
  // One owner for each workspace. The database refuses a second one even when
  // application code slips.
  uniqueIndex('workspace_members_single_owner_idx')
    .on(table.workspaceId)
    .where(sql`role = 'OWNER'`),
]);

// Every invitation joins as MEMBER, so the table carries no role. A workspace
// holds one owner, and only transfer changes who that is.
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  invitedByUserId: text('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestampTz('created_at').notNull(),
  expiresAt: timestampTz('expires_at').notNull(),
  acceptedAt: timestampTz('accepted_at'),
  revokedAt: timestampTz('revoked_at'),
}, table => [
  index('workspace_invitations_workspace_id_idx').on(table.workspaceId),
  index('workspace_invitations_email_idx').on(table.email),
]);

export const authProviders = ['PASSWORD', 'GOOGLE', 'MICROSOFT'] as const;

export type AuthProvider = typeof authProviders[number];

export const authIdentities = pgTable('auth_identities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: authProviders }).notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestampTz('created_at').notNull(),
  updatedAt: timestampTz('updated_at').notNull(),
}, table => [
  uniqueIndex('auth_identities_provider_account_unique_idx').on(table.provider, table.providerAccountId),
  index('auth_identities_user_id_idx').on(table.userId),
]);

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  utmCampaign: text('utm_campaign').notNull(),
  utmMedium: text('utm_medium'),
  createdAt: timestampTz('created_at').notNull(),
  updatedAt: timestampTz('updated_at').notNull(),
}, table => [
  index('campaigns_workspace_id_created_at_idx').on(table.workspaceId, table.createdAt),
  uniqueIndex('campaigns_workspace_utm_campaign_unique_idx').on(table.workspaceId, table.utmCampaign),
]);

export const links = pgTable('links', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  title: text('title'),
  destinationUrl: text('destination_url').notNull(),
  destinationHost: text('destination_host').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  expiresAt: timestampTz('expires_at'),
  passwordHash: text('password_hash'),
  startsAt: timestampTz('starts_at'),
  expirationDestination: text('expiration_destination'),
  maximumVisits: integer('maximum_visits'),
  successfulVisitCount: integer('successful_visit_count').notNull().default(0),
  clickCount: integer('click_count').notNull().default(0),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  utmSource: text('utm_source'),
  utmCampaign: text('utm_campaign'),
  utmTerm: text('utm_term'),
  utmContent: text('utm_content'),
  createdAt: timestampTz('created_at').notNull(),
  updatedAt: timestampTz('updated_at').notNull(),
}, table => [
  index('links_workspace_id_created_at_idx').on(table.workspaceId, table.createdAt),
  index('links_campaign_id_idx').on(table.campaignId),
  uniqueIndex('links_workspace_slug_unique_idx').on(table.workspaceId, table.slug),
]);

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  createdAt: timestampTz('created_at').notNull(),
}, table => [
  uniqueIndex('tags_workspace_normalized_name_unique_idx').on(table.workspaceId, table.normalizedName),
  index('tags_workspace_id_created_at_idx').on(table.workspaceId, table.createdAt),
]);

export const linkTags = pgTable('link_tags', {
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, table => [
  primaryKey({ columns: [table.linkId, table.tagId] }),
  index('link_tags_tag_id_idx').on(table.tagId),
]);

export const clickEventOutcomes = [
  'redirect_success',
  'bot_request',
  'password_failed',
  'scheduled_block',
  'disabled_block',
  'expired_block',
  'expired_redirect',
  'limit_reached',
] as const;

export type ClickEventOutcome = typeof clickEventOutcomes[number];

export const clickEvents = pgTable('click_events', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: timestampTz('created_at').notNull(),
  referrerHost: text('referrer_host'),
  country: text('country'),
  deviceCategory: text('device_category', { enum: ['desktop', 'mobile', 'tablet', 'other'] }).notNull(),
  browserCategory: text('browser_category').notNull(),
  outcome: text('outcome', { enum: clickEventOutcomes }),
  isBot: boolean('is_bot'),
  botCategory: text('bot_category'),
  visitorHash: text('visitor_hash'),
}, table => [
  index('click_events_link_id_created_at_idx').on(table.linkId, table.createdAt),
  index('click_events_link_id_outcome_created_at_idx').on(table.linkId, table.outcome, table.createdAt),
  index('click_events_workspace_id_created_at_idx').on(table.workspaceId, table.createdAt),
]);

// workspaceId is nullable because a sign-in failure happens before any
// workspace is known. A null row is operator-only and never reaches the
// workspace UI, which filters on a concrete workspace.
export const securityEvents = pgTable('security_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: timestampTz('created_at').notNull(),
  type: text('type').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  linkId: text('link_id').references(() => links.id, { onDelete: 'set null' }),
  detail: text('detail'),
}, table => [
  index('security_events_link_id_created_at_idx').on(table.linkId, table.createdAt),
  index('security_events_workspace_id_created_at_idx').on(table.workspaceId, table.createdAt),
]);

// A slug released in one workspace must not block another workspace.
export const reservedSlugs = pgTable('reserved_slugs', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  releasedAt: timestampTz('released_at'),
}, table => [
  primaryKey({ columns: [table.workspaceId, table.slug] }),
]);

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestampTz('expires_at').notNull(),
  consumedAt: timestampTz('consumed_at'),
  createdAt: timestampTz('created_at').notNull(),
}, table => [
  index('email_verification_tokens_user_id_idx').on(table.userId),
]);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestampTz('expires_at').notNull(),
  consumedAt: timestampTz('consumed_at'),
  createdAt: timestampTz('created_at').notNull(),
}, table => [
  index('password_reset_tokens_user_id_idx').on(table.userId),
]);

// Only a test configuration writes this. It lets a test read a message that
// the server process sent, because the server runs in its own process.
export const mailOutbox = pgTable('mail_outbox', {
  id: text('id').primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  createdAt: timestampTz('created_at').notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthIdentity = typeof authIdentities.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type ResolvedLink = Link & { utmMedium: string | null; utmCampaign: string | null };
export type ClickEvent = typeof clickEvents.$inferSelect;
