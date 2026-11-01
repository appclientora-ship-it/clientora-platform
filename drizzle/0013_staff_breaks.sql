CREATE TABLE IF NOT EXISTS `staffBreaks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `staffId` int NOT NULL,
  `weekday` int NOT NULL,
  `startMinutes` int NOT NULL,
  `endMinutes` int NOT NULL,
  `active` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `staffBreaks_staff_weekday_active_idx` (`tenantId`, `staffId`, `weekday`, `active`)
);
