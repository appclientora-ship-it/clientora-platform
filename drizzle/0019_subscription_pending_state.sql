ALTER TABLE `tenantSubscriptions`
  MODIFY COLUMN `status` enum('pending','active','past_due','suspended','cancelled') NOT NULL DEFAULT 'pending';
