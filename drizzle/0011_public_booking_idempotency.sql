SET @clientora_idem_col_0_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'idempotencyKey');
--> statement-breakpoint
SET @clientora_idem_col_0_sql = IF(@clientora_idem_col_0_exists = 0, 'ALTER TABLE `bookings` ADD COLUMN `idempotencyKey` varchar(64) NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_idem_col_0_stmt FROM @clientora_idem_col_0_sql;
--> statement-breakpoint
EXECUTE clientora_idem_col_0_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_idem_col_0_stmt;
--> statement-breakpoint
SET @clientora_idem_col_1_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'requestHash');
--> statement-breakpoint
SET @clientora_idem_col_1_sql = IF(@clientora_idem_col_1_exists = 0, 'ALTER TABLE `bookings` ADD COLUMN `requestHash` varchar(64) NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_idem_col_1_stmt FROM @clientora_idem_col_1_sql;
--> statement-breakpoint
EXECUTE clientora_idem_col_1_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_idem_col_1_stmt;
--> statement-breakpoint
SET @clientora_idem_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'bookings_tenant_idempotency_unique');
--> statement-breakpoint
SET @clientora_idem_index_sql = IF(@clientora_idem_index_exists = 0, 'CREATE UNIQUE INDEX `bookings_tenant_idempotency_unique` ON `bookings` (`tenantId`,`idempotencyKey`)', 'SELECT 1');
--> statement-breakpoint
PREPARE clientora_idem_index_stmt FROM @clientora_idem_index_sql;
--> statement-breakpoint
EXECUTE clientora_idem_index_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE clientora_idem_index_stmt;
