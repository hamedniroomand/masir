CREATE TABLE `click_events` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`referrer_host` text,
	`country` text,
	`device_category` text NOT NULL,
	`browser_category` text NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `click_events_link_id_created_at_idx` ON `click_events` (`link_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text,
	`destination_url` text NOT NULL,
	`destination_host` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`click_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_slug_unique` ON `links` (`slug`);--> statement-breakpoint
CREATE INDEX `links_user_id_created_at_idx` ON `links` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `links_slug_unique_idx` ON `links` (`slug`);--> statement-breakpoint
CREATE TABLE `reserved_slugs` (
	`slug` text PRIMARY KEY NOT NULL,
	`released_at` integer
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`type` text NOT NULL,
	`actor_user_id` text,
	`detail` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);