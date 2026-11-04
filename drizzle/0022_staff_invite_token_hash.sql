ALTER TABLE `staffInvites` ADD COLUMN `codeHash` varchar(64) NULL;
--> statement-breakpoint
UPDATE `staffInvites` SET `codeHash` = SHA2(`code`, 256) WHERE `code` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `staffInvites` MODIFY COLUMN `code` varchar(64) NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `staffInvites_codeHash_unique` ON `staffInvites` (`codeHash`);
--> statement-breakpoint
UPDATE `staffInvites` SET `code` = NULL WHERE `codeHash` IS NOT NULL;
