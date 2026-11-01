ALTER TABLE `bookings` ADD COLUMN `idempotencyKey` varchar(64) NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD COLUMN `requestHash` varchar(64) NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_tenant_idempotency_unique` ON `bookings` (`tenantId`,`idempotencyKey`);--> statement-breakpoint
