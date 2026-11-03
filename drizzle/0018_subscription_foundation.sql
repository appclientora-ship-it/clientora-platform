CREATE TABLE IF NOT EXISTS `subscriptionPlans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `planKey` varchar(16) NOT NULL,
  `staffLimit` int NOT NULL,
  `monthlyPriceCents` int NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `active` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscriptionPlans_planKey_unique` (`planKey`)
);
--> statement-breakpoint
INSERT INTO `subscriptionPlans` (`planKey`, `staffLimit`, `monthlyPriceCents`, `currency`) VALUES
  ('Solo', 1, 700, 'USD'),
  ('S3', 3, 1300, 'USD'),
  ('S7', 7, 1500, 'USD'),
  ('S9', 9, 1900, 'USD'),
  ('S15', 15, 2500, 'USD'),
  ('S21', 21, 2900, 'USD'),
  ('S27', 27, 3500, 'USD'),
  ('S35', 35, 4300, 'USD');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tenantSubscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `planId` int NULL,
  `status` enum('active','past_due','suspended','cancelled') NOT NULL DEFAULT 'active',
  `currentPeriodStart` timestamp NULL DEFAULT NULL,
  `currentPeriodEnd` timestamp NULL DEFAULT NULL,
  `gracePeriodEndsAt` timestamp NULL DEFAULT NULL,
  `graceDays` int NOT NULL DEFAULT 21,
  `autoRenew` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenantSubscriptions_tenant_unique` (`tenantId`),
  KEY `tenantSubscriptions_period_end_idx` (`currentPeriodEnd`),
  KEY `tenantSubscriptions_status_grace_idx` (`status`, `gracePeriodEndsAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptionEvents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `actorUserId` int NULL,
  `action` varchar(64) NOT NULL,
  `details` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `subscriptionEvents_tenant_created_idx` (`tenantId`, `createdAt`)
);
