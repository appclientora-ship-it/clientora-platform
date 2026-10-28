CREATE TABLE `bookingItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`bookingId` int NOT NULL,
	`serviceId` int NOT NULL,
	`staffId` int NOT NULL,
	`durationMinutes` int NOT NULL,
	`price` int NOT NULL,
	CONSTRAINT `bookingItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `durationMinutes` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `totalPrice` int DEFAULT 0 NOT NULL;