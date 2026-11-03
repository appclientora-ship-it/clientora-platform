ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
UPDATE `users` SET `emailVerifiedAt` = `createdAt` WHERE `emailVerifiedAt` IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `emailVerifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emailVerifications_tokenHash_unique` (`tokenHash`),
  KEY `emailVerifications_user_created_idx` (`userId`, `createdAt`)
);
