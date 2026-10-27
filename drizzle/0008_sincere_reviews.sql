CREATE TABLE `booking_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`bookingId` int NOT NULL,
	`clientId` int NOT NULL,
	`staffId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` varchar(1000),
	`published` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_review_booking_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
CREATE INDEX `booking_reviews_staff_idx` ON `booking_reviews` (`tenantId`,`staffId`,`published`);
