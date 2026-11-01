CREATE TABLE `clientNotes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `clientId` int NOT NULL,
  `authorUserId` int NOT NULL,
  `note` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `client_notes_tenant_client_created_idx` (`tenantId`, `clientId`, `createdAt`)
);
