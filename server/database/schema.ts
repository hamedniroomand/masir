import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  utmCampaign: text('utm_campaign').notNull(),
  utmMedium: text('utm_medium'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [
  index('campaigns_user_id_created_at_idx').on(table.userId, table.createdAt),
  uniqueIndex('campaigns_user_id_utm_campaign_unique_idx').on(table.userId, table.utmCampaign),
]);

export const links = sqliteTable('links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  slug: text('slug').notNull().unique(),
  title: text('title'),
  destinationUrl: text('destination_url').notNull(),
  destinationHost: text('destination_host').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  passwordHash: text('password_hash'),
  startsAt: integer('starts_at', { mode: 'timestamp_ms' }),
  expirationDestination: text('expiration_destination'),
  maximumVisits: integer('maximum_visits'),
  successfulVisitCount: integer('successful_visit_count').notNull().default(0),
  clickCount: integer('click_count').notNull().default(0),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  utmSource: text('utm_source'),
  utmCampaign: text('utm_campaign'),
  utmTerm: text('utm_term'),
  utmContent: text('utm_content'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [
  index('links_user_id_created_at_idx').on(table.userId, table.createdAt),
  index('links_campaign_id_idx').on(table.campaignId),
  uniqueIndex('links_slug_unique_idx').on(table.slug),
]);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [
  uniqueIndex('tags_user_id_normalized_name_unique_idx').on(table.userId, table.normalizedName),
  index('tags_user_id_created_at_idx').on(table.userId, table.createdAt),
]);

export const linkTags = sqliteTable('link_tags', {
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

export const clickEvents = sqliteTable('click_events', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  referrerHost: text('referrer_host'),
  country: text('country'),
  deviceCategory: text('device_category', { enum: ['desktop', 'mobile', 'tablet', 'other'] }).notNull(),
  browserCategory: text('browser_category').notNull(),
  outcome: text('outcome', { enum: clickEventOutcomes }),
  isBot: integer('is_bot', { mode: 'boolean' }),
  botCategory: text('bot_category'),
  visitorHash: text('visitor_hash'),
}, table => [
  index('click_events_link_id_created_at_idx').on(table.linkId, table.createdAt),
  index('click_events_link_id_outcome_created_at_idx').on(table.linkId, table.outcome, table.createdAt),
]);

export const securityEvents = sqliteTable('security_events', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  type: text('type').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  linkId: text('link_id').references(() => links.id, { onDelete: 'set null' }),
  detail: text('detail'),
}, table => [
  index('security_events_link_id_created_at_idx').on(table.linkId, table.createdAt),
]);

export const reservedSlugs = sqliteTable('reserved_slugs', {
  slug: text('slug').primaryKey(),
  releasedAt: integer('released_at', { mode: 'timestamp_ms' }),
});

export type User = typeof users.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type ResolvedLink = Link & { utmMedium: string | null; utmCampaign: string | null };
export type ClickEvent = typeof clickEvents.$inferSelect;
