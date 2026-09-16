ALTER TABLE `links` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `links` ADD `starts_at` integer;--> statement-breakpoint
ALTER TABLE `links` ADD `expiration_destination` text;--> statement-breakpoint
ALTER TABLE `links` ADD `maximum_visits` integer;--> statement-breakpoint
ALTER TABLE `links` ADD `successful_visit_count` integer DEFAULT 0 NOT NULL;