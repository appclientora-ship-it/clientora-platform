ALTER TABLE `users` ADD COLUMN `language` varchar(10) DEFAULT 'ar';--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `countryCode` varchar(2) DEFAULT 'OM';--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `timezone` varchar(64) DEFAULT 'Asia/Muscat';--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `defaultLanguage` varchar(10) DEFAULT 'ar';--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `userId` int NULL;--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `photoUrl` varchar(500) NULL;--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `bio` varchar(500) NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD COLUMN `completedAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `status` enum('new','confirmed','arrived','completed','cancelled','no_show') NOT NULL DEFAULT 'new';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staffWorkingHours` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `staffId` int NOT NULL, `weekday` int NOT NULL, `openMinutes` int NOT NULL, `closeMinutes` int NOT NULL, `active` int NOT NULL DEFAULT 1, CONSTRAINT `staffWorkingHours_id` PRIMARY KEY(`id`));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staffInvites` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `staffId` int, `email` varchar(320), `code` varchar(64) NOT NULL, `role` enum('staff','manager') NOT NULL DEFAULT 'staff', `expiresAt` timestamp NOT NULL, `acceptedAt` timestamp NULL, `createdByUserId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `staffInvites_id` PRIMARY KEY(`id`), CONSTRAINT `staffInvites_code_unique` UNIQUE(`code`));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notifications` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `recipientUserId` int, `recipientStaffId` int, `type` varchar(60) NOT NULL, `title` varchar(180) NOT NULL, `body` varchar(500) NOT NULL, `entity` varchar(80), `entityId` int, `readAt` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `notifications_id` PRIMARY KEY(`id`));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bookingReviews` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `bookingId` int NOT NULL, `clientId` int NOT NULL, `staffId` int NOT NULL, `rating` int NOT NULL, `comment` varchar(1000), `published` int NOT NULL DEFAULT 0, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `bookingReviews_id` PRIMARY KEY(`id`), CONSTRAINT `bookingReviews_booking_unique` UNIQUE(`bookingId`));
