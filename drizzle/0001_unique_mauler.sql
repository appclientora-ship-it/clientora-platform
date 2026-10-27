CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entity` varchar(80) NOT NULL,
	`entityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`bookingId` int NOT NULL,
	`serviceId` int NOT NULL,
	`staffId` int NOT NULL,
	`durationMinutes` int NOT NULL,
	`price` int NOT NULL,
	CONSTRAINT `booking_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`clientId` int NOT NULL,
	`staffId` int NOT NULL,
	`serviceId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`startMinutes` int NOT NULL,
	`durationMinutes` int NOT NULL,
	`totalPrice` int NOT NULL,
	`status` enum('new','confirmed','arrived','cancelled','no_show') NOT NULL DEFAULT 'new',
	`source` enum('dashboard','online') NOT NULL DEFAULT 'dashboard',
	`paid` int NOT NULL DEFAULT 0,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`visits` int NOT NULL DEFAULT 0,
	`totalSpent` int NOT NULL DEFAULT 0,
	`lastVisit` varchar(10),
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_tenant_phone` UNIQUE(`tenantId`,`phone`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` varchar(500) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(120) NOT NULL DEFAULT 'عام',
	`durationMinutes` int NOT NULL,
	`price` int NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`role` varchar(120) NOT NULL DEFAULT 'متخصص',
	`color` varchar(20) NOT NULL DEFAULT '#0d8f83',
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','manager','staff') NOT NULL DEFAULT 'staff',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_member_unique` UNIQUE(`tenantId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`city` varchar(120),
	`currency` varchar(12) NOT NULL DEFAULT 'ر.ع',
	`status` enum('trial','active','suspended') NOT NULL DEFAULT 'trial',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
