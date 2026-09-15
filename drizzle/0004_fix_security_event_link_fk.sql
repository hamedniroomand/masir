PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`type` text NOT NULL,
	`actor_user_id` text,
	`link_id` text,
	`detail` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_security_events`(`id`, `created_at`, `type`, `actor_user_id`, `link_id`, `detail`) SELECT `id`, `created_at`, `type`, `actor_user_id`, `link_id`, `detail` FROM `security_events`;--> statement-breakpoint
DROP TABLE `security_events`;--> statement-breakpoint
ALTER TABLE `__new_security_events` RENAME TO `security_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `security_events_link_id_created_at_idx` ON `security_events` (`link_id`,`created_at`);
