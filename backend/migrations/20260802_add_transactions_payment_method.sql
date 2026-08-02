-- Add payment_method to transactions for Mobile Money / Cash flows
-- Railway/MySQL safe and idempotent.

SET @db_name = DATABASE();

-- 1) Ensure table exists first
SET @transactions_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'transactions'
);

-- 2) Add column only if missing
SET @sql_add_payment_method = (
  SELECT IF(
    @transactions_exists = 0,
    'SELECT "transactions table not found"',
    IF(
      EXISTS(
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @db_name
          AND TABLE_NAME = 'transactions'
          AND COLUMN_NAME = 'payment_method'
      ),
      'SELECT "transactions.payment_method already exists"',
      'ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(20) NULL'
    )
  )
);
PREPARE stmt_add_payment_method FROM @sql_add_payment_method;
EXECUTE stmt_add_payment_method;
DEALLOCATE PREPARE stmt_add_payment_method;

-- 3) Normalize legacy rows only when table exists
SET @sql_backfill_payment_method = (
  SELECT IF(
    @transactions_exists = 0,
    'SELECT "skip backfill: transactions table not found"',
    "UPDATE transactions
     SET payment_method = 'mobile_money'
     WHERE payment_method IS NULL
        OR TRIM(payment_method) = ''
        OR LOWER(TRIM(payment_method)) NOT IN ('mobile_money','cash')"
  )
);
PREPARE stmt_backfill_payment_method FROM @sql_backfill_payment_method;
EXECUTE stmt_backfill_payment_method;
DEALLOCATE PREPARE stmt_backfill_payment_method;

-- 4) Add index for admin filter (method) when missing
SET @sql_add_method_index = (
  SELECT IF(
    @transactions_exists = 0,
    'SELECT "skip index: transactions table not found"',
    IF(
      EXISTS(
        SELECT 1
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = @db_name
          AND TABLE_NAME = 'transactions'
          AND INDEX_NAME = 'idx_transactions_payment_method'
      ),
      'SELECT "idx_transactions_payment_method already exists"',
      'ALTER TABLE transactions ADD INDEX idx_transactions_payment_method (payment_method)'
    )
  )
);
PREPARE stmt_add_method_index FROM @sql_add_method_index;
EXECUTE stmt_add_method_index;
DEALLOCATE PREPARE stmt_add_method_index;
