CREATE TABLE IF NOT EXISTS `staffTimeOff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `staffId` int NOT NULL,
  `date` varchar(10) NOT NULL,
  `reason` varchar(240),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
