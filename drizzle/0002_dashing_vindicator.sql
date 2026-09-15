ALTER TABLE `security_events` ADD `link_id` text REFERENCES links(id);--> statement-breakpoint
CREATE INDEX `security_events_link_id_created_at_idx` ON `security_events` (`link_id`,`created_at`);--> statement-breakpoint
UPDATE `security_events` SET `link_id` = json_extract(`detail`, '$.linkId') WHERE `link_id` IS NULL AND `detail` LIKE '%"linkId"%';
