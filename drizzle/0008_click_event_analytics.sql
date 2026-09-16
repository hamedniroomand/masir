ALTER TABLE `click_events` ADD `outcome` text;--> statement-breakpoint
ALTER TABLE `click_events` ADD `is_bot` integer;--> statement-breakpoint
ALTER TABLE `click_events` ADD `bot_category` text;--> statement-breakpoint
ALTER TABLE `click_events` ADD `visitor_hash` text;--> statement-breakpoint
CREATE INDEX `click_events_link_id_outcome_created_at_idx` ON `click_events` (`link_id`,`outcome`,`created_at`);