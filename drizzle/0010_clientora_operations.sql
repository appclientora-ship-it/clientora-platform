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
SET @clientora_col_0_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'countryCode');
--> statement-breakpoint
SET @clientora_col_0_sql = IF(@clientora_col_0_exists = 0, 'ALTER TABLE `tenants` ADD COLUMN `countryCode` varchar(2) DEFAULT ''OM''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_0_stmt FROM @clientora_col_0_sql;
--> statement-breakpoint
EXECUTE clientora_col_0_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_0_stmt;
--> statement-breakpoint
SET @clientora_col_1_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'timezone');
--> statement-breakpoint
SET @clientora_col_1_sql = IF(@clientora_col_1_exists = 0, 'ALTER TABLE `tenants` ADD COLUMN `timezone` varchar(64) DEFAULT ''Asia/Muscat''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_1_stmt FROM @clientora_col_1_sql;
--> statement-breakpoint
EXECUTE clientora_col_1_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_1_stmt;
--> statement-breakpoint
SET @clientora_col_2_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'defaultLanguage');
--> statement-breakpoint
SET @clientora_col_2_sql = IF(@clientora_col_2_exists = 0, 'ALTER TABLE `tenants` ADD COLUMN `defaultLanguage` varchar(10) DEFAULT ''ar''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_2_stmt FROM @clientora_col_2_sql;
--> statement-breakpoint
EXECUTE clientora_col_2_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_2_stmt;
--> statement-breakpoint
SET @clientora_col_3_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'userId');
--> statement-breakpoint
SET @clientora_col_3_sql = IF(@clientora_col_3_exists = 0, 'ALTER TABLE `staff` ADD COLUMN `userId` int NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_3_stmt FROM @clientora_col_3_sql;
--> statement-breakpoint
EXECUTE clientora_col_3_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_3_stmt;
--> statement-breakpoint
SET @clientora_col_4_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'photoUrl');
--> statement-breakpoint
SET @clientora_col_4_sql = IF(@clientora_col_4_exists = 0, 'ALTER TABLE `staff` ADD COLUMN `photoUrl` varchar(500) NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_4_stmt FROM @clientora_col_4_sql;
--> statement-breakpoint
EXECUTE clientora_col_4_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_4_stmt;
--> statement-breakpoint
SET @clientora_col_5_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'bio');
--> statement-breakpoint
SET @clientora_col_5_sql = IF(@clientora_col_5_exists = 0, 'ALTER TABLE `staff` ADD COLUMN `bio` varchar(500) NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_5_stmt FROM @clientora_col_5_sql;
--> statement-breakpoint
EXECUTE clientora_col_5_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_5_stmt;
--> statement-breakpoint
SET @clientora_col_6_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'completedAt');
--> statement-breakpoint
SET @clientora_col_6_sql = IF(@clientora_col_6_exists = 0, 'ALTER TABLE `bookings` ADD COLUMN `completedAt` timestamp NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_col_6_stmt FROM @clientora_col_6_sql;
--> statement-breakpoint
EXECUTE clientora_col_6_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_col_6_stmt;
--> statement-breakpoint
SET @clientora_booking_status_type = (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'status');
--> statement-breakpoint
SET @clientora_booking_status_sql = IF(@clientora_booking_status_type NOT LIKE '%completed%', 'ALTER TABLE `bookings` MODIFY COLUMN `status` enum(''new'',''confirmed'',''arrived'',''completed'',''cancelled'',''no_show'') NOT NULL DEFAULT ''new''', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_booking_status_stmt FROM @clientora_booking_status_sql;
--> statement-breakpoint
EXECUTE clientora_booking_status_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_booking_status_stmt;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staffWorkingHours` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `staffId` int NOT NULL, `weekday` int NOT NULL, `openMinutes` int NOT NULL, `closeMinutes` int NOT NULL, `active` int NOT NULL DEFAULT 1, CONSTRAINT `staffWorkingHours_id` PRIMARY KEY(`id`));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staffInvites` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `staffId` int, `email` varchar(320), `code` varchar(64) NOT NULL, `role` enum('staff','manager') NOT NULL DEFAULT 'staff', `expiresAt` timestamp NOT NULL, `acceptedAt` timestamp NULL, `createdByUserId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `staffInvites_id` PRIMARY KEY(`id`), CONSTRAINT `staffInvites_code_unique` UNIQUE(`code`));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notifications` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `recipientUserId` int, `recipientStaffId` int, `type` varchar(60) NOT NULL, `title` varchar(180) NOT NULL, `body` varchar(500) NOT NULL, `entity` varchar(80), `entityId` int, `readAt` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `notifications_id` PRIMARY KEY(`id`));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bookingReviews` (`id` int AUTO_INCREMENT NOT NULL, `tenantId` int NOT NULL, `bookingId` int NOT NULL, `clientId` int NOT NULL, `staffId` int NOT NULL, `rating` int NOT NULL, `comment` varchar(1000), `published` int NOT NULL DEFAULT 0, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `bookingReviews_id` PRIMARY KEY(`id`), CONSTRAINT `bookingReviews_booking_unique` UNIQUE(`bookingId`));
