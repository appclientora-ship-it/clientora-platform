CREATE TABLE IF NOT EXISTS `telegramLinks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `telegramUserId` varchar(32) NOT NULL,
  `linkedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revokedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `telegramLinks_telegram_user_unique` (`telegramUserId`),
  KEY `telegramLinks_user_id_idx` (`userId`)
);

CREATE TABLE IF NOT EXISTS `telegramLinkTokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `telegramLinkTokens_token_hash_unique` (`tokenHash`),
  KEY `telegramLinkTokens_user_expiry_idx` (`userId`, `expiresAt`)
);
