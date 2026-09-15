CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`utm_campaign` text NOT NULL,
	`utm_medium` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `campaigns_user_id_created_at_idx` ON `campaigns` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `links` ADD `campaign_id` text REFERENCES campaigns(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `utm_source` text;--> statement-breakpoint
ALTER TABLE `links` ADD `utm_content` text;--> statement-breakpoint
CREATE INDEX `links_campaign_id_idx` ON `links` (`campaign_id`);