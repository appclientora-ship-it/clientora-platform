CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` varchar(240) NOT NULL,
	`vendor` varchar(160),
	`amount` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`paymentMethod` varchar(40) NOT NULL DEFAULT 'نقدي',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
