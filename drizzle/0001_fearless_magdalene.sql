ALTER TABLE `users` ADD `is_super_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `users` SET `is_super_admin` = 1 WHERE `id` = (SELECT `id` FROM `users` WHERE `role` = 'admin' ORDER BY `created_at`, `id` LIMIT 1);
