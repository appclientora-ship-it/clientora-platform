ALTER TABLE `tenants` MODIFY COLUMN `status` enum('pending','trial','active','suspended') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `tenants` ADD `subscriptionStartedAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `subscriptionEndsAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `paymentReference` varchar(120);--> statement-breakpoint
ALTER TABLE `tenants` ADD `paymentReceivedAt` timestamp NULL;
