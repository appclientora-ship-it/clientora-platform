CREATE TABLE IF NOT EXISTS `platformAdminBootstrap` (
  `id` int NOT NULL,
  `claimedAt` timestamp NULL DEFAULT NULL,
  `claimedByUserId` int NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
);

INSERT IGNORE INTO `platformAdminBootstrap` (`id`, `claimedAt`, `claimedByUserId`) VALUES (1, NULL, NULL);

CREATE TABLE IF NOT EXISTS `platformAdminAuditLogs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actorUserId` int NULL,
  `targetUserId` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `previousRole` varchar(20) NOT NULL,
  `newRole` varchar(20) NOT NULL,
  `reason` varchar(500) NULL,
  `actorIp` varchar(64) NULL,
  `actorUserAgent` varchar(500) NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `platformAdminAuditLogs_target_created_idx` (`targetUserId`, `createdAt`),
  KEY `platformAdminAuditLogs_actor_created_idx` (`actorUserId`, `createdAt`)
);

CREATE TABLE IF NOT EXISTS `rateLimitBuckets` (
  `bucketKey` varchar(64) NOT NULL,
  `count` int unsigned NOT NULL,
  `resetAt` timestamp(3) NOT NULL,
  PRIMARY KEY (`bucketKey`),
  KEY `rateLimitBuckets_resetAt_idx` (`resetAt`)
);
