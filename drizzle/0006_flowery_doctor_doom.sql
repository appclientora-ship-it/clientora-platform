CREATE TABLE `staff_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`role` enum('staff','manager') NOT NULL DEFAULT 'staff',
	`active` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `staff` ADD `userId` int;