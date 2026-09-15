import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const links = sqliteTable('links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  slug: text('slug').notNull().unique(),
  title: text('title'),
  destinationUrl: text('destination_url').notNull(),
  destinationHost: text('destination_host').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  clickCount: integer('click_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [
  index('links_user_id_created_at_idx').on(table.userId, table.createdAt),
  uniqueIndex('links_slug_unique_idx').on(table.slug),
]);

export const clickEvents = sqliteTable('click_events', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  referrerHost: text('referrer_host'),
  country: text('country'),
  deviceCategory: text('device_category', { enum: ['desktop', 'mobile', 'tablet', 'other'] }).notNull(),
  browserCategory: text('browser_category').notNull(),
}, table => [
  index('click_events_link_id_created_at_idx').on(table.linkId, table.createdAt),
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
export type ClickEvent = typeof clickEvents.$inferSelect;
