SET @clientora_language_column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'language');
--> statement-breakpoint
SET @clientora_language_migration_sql = IF(@clientora_language_column_exists = 0, 'ALTER TABLE `users` ADD COLUMN `language` varchar(10) DEFAULT ''ar''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_language_migration_stmt FROM @clientora_language_migration_sql;
--> statement-breakpoint
EXECUTE clientora_language_migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_language_migration_stmt;
--> statement-breakpoint
SET @clientora_tenants_countryCode_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'countryCode');
--> statement-breakpoint
SET @clientora_tenants_countryCode_sql = IF(@clientora_tenants_countryCode_exists = 0, 'ALTER TABLE `tenants` ADD COLUMN `countryCode` varchar(2) DEFAULT ''OM''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_tenants_countryCode_stmt FROM @clientora_tenants_countryCode_sql;
--> statement-breakpoint
EXECUTE clientora_tenants_countryCode_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_tenants_countryCode_stmt;
--> statement-breakpoint
SET @clientora_tenants_timezone_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'timezone');
--> statement-breakpoint
SET @clientora_tenants_timezone_sql = IF(@clientora_tenants_timezone_exists = 0, 'ALTER TABLE `tenants` ADD COLUMN `timezone` varchar(64) DEFAULT ''Asia/Muscat''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_tenants_timezone_stmt FROM @clientora_tenants_timezone_sql;
--> statement-breakpoint
EXECUTE clientora_tenants_timezone_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_tenants_timezone_stmt;
--> statement-breakpoint
SET @clientora_tenants_defaultLanguage_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'defaultLanguage');
--> statement-breakpoint
SET @clientora_tenants_defaultLanguage_sql = IF(@clientora_tenants_defaultLanguage_exists = 0, 'ALTER TABLE `tenants` ADD COLUMN `defaultLanguage` varchar(10) DEFAULT ''ar''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_tenants_defaultLanguage_stmt FROM @clientora_tenants_defaultLanguage_sql;
--> statement-breakpoint
EXECUTE clientora_tenants_defaultLanguage_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_tenants_defaultLanguage_stmt;
--> statement-breakpoint
SET @clientora_staff_userId_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'userId');
--> statement-breakpoint
SET @clientora_staff_userId_sql = IF(@clientora_staff_userId_exists = 0, 'ALTER TABLE `staff` ADD COLUMN `userId` int NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_staff_userId_stmt FROM @clientora_staff_userId_sql;
--> statement-breakpoint
EXECUTE clientora_staff_userId_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_staff_userId_stmt;
--> statement-breakpoint
SET @clientora_staff_photoUrl_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'photoUrl');
--> statement-breakpoint
SET @clientora_staff_photoUrl_sql = IF(@clientora_staff_photoUrl_exists = 0, 'ALTER TABLE `staff` ADD COLUMN `photoUrl` varchar(500) NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_staff_photoUrl_stmt FROM @clientora_staff_photoUrl_sql;
--> statement-breakpoint
EXECUTE clientora_staff_photoUrl_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_staff_photoUrl_stmt;
--> statement-breakpoint
SET @clientora_staff_bio_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'bio');
--> statement-breakpoint
SET @clientora_staff_bio_sql = IF(@clientora_staff_bio_exists = 0, 'ALTER TABLE `staff` ADD COLUMN `bio` varchar(500) NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_staff_bio_stmt FROM @clientora_staff_bio_sql;
--> statement-breakpoint
EXECUTE clientora_staff_bio_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_staff_bio_stmt;
--> statement-breakpoint
SET @clientora_bookings_completedAt_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'completedAt');
--> statement-breakpoint
SET @clientora_bookings_completedAt_sql = IF(@clientora_bookings_completedAt_exists = 0, 'ALTER TABLE `bookings` ADD COLUMN `completedAt` timestamp NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_bookings_completedAt_stmt FROM @clientora_bookings_completedAt_sql;
--> statement-breakpoint
EXECUTE clientora_bookings_completedAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_bookings_completedAt_stmt;
--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `status` enum('new','confirmed','arrived','completed','cancelled','no_show') NOT NULL DEFAULT 'new';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staffWorkingHours` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `staffId` int NOT NULL, `weekday` int NOT NULL, `openMinutes` int NOT NULL, `closeMinutes` int NOT NULL, `active` int NOT NULL DEFAULT 1, CONSTRAINT `staffWorkingHours_id` PRIMARY KEY(`id`));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staffInvites` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `staffId` int, `email` varchar(320), `code` varchar(64) NOT NULL, `role` enum('staff','manager') NOT NULL DEFAULT 'staff', `expiresAt` timestamp NOT NULL, `acceptedAt` timestamp NULL, `createdByUserId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `staffInvites_id` PRIMARY KEY(`id`), CONSTRAINT `staffInvites_code_unique` UNIQUE(`code`));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notifications` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `recipientUserId` int, `recipientStaffId` int, `type` varchar(60) NOT NULL, `title` varchar(180) NOT NULL, `body` varchar(500) NOT NULL, `entity` varchar(80), `entityId` int, `readAt` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `notifications_id` PRIMARY KEY(`id`));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bookingReviews` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `bookingId` int NOT NULL, `clientId` int NOT NULL, `staffId` int NOT NULL, `rating` int NOT NULL, `comment` varchar(1000), `published` int NOT NULL DEFAULT 0, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `bookingReviews_id` PRIMARY KEY(`id`), CONSTRAINT `bookingReviews_booking_unique` UNIQUE(`bookingId`));
