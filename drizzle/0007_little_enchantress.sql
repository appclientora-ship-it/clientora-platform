CREATE TABLE `product_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`productId` int NOT NULL,
	`bookingId` int,
	`clientId` int,
	`staffId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`commissionRate` int NOT NULL,
	`commissionAmount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(120) NOT NULL DEFAULT 'عام',
	`sku` varchar(80),
	`salePrice` int NOT NULL,
	`costPrice` int NOT NULL DEFAULT 0,
	`stock` int NOT NULL DEFAULT 0,
	`lowStockAt` int NOT NULL DEFAULT 5,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `staff` ADD `commissionRate` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff` ADD `commissionBasis` enum('gross','net') DEFAULT 'gross' NOT NULL;