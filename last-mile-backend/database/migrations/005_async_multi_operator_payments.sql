ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM(
    'orange_money',
    'mtn_momo',
    'card'
  ) NULL DEFAULT NULL;

SET @payment_reference_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'payment_reference'
);

SET @payment_reference_migration = IF(
  @payment_reference_column_exists = 0,
  'ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(64) NULL DEFAULT NULL AFTER payment_method',
  'SELECT 1'
);

PREPARE payment_reference_statement FROM @payment_reference_migration;
EXECUTE payment_reference_statement;
DEALLOCATE PREPARE payment_reference_statement;

SET @payment_reference_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'uq_orders_payment_reference'
);

SET @payment_reference_index_migration = IF(
  @payment_reference_index_exists = 0,
  'ALTER TABLE orders ADD UNIQUE INDEX uq_orders_payment_reference (payment_reference)',
  'SELECT 1'
);

PREPARE payment_reference_index_statement FROM @payment_reference_index_migration;
EXECUTE payment_reference_index_statement;
DEALLOCATE PREPARE payment_reference_index_statement;

SET @payment_status_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_payment_status'
);

SET @payment_status_index_migration = IF(
  @payment_status_index_exists = 0,
  'ALTER TABLE orders ADD INDEX idx_orders_payment_status (payment_status)',
  'SELECT 1'
);

PREPARE payment_status_index_statement FROM @payment_status_index_migration;
EXECUTE payment_status_index_statement;
DEALLOCATE PREPARE payment_status_index_statement;
