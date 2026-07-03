SET @description_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'description'
);

SET @description_migration = IF(
  @description_column_exists = 0,
  'ALTER TABLE orders ADD COLUMN description TEXT NULL AFTER delivery_address',
  'SELECT 1'
);

PREPARE description_statement FROM @description_migration;
EXECUTE description_statement;
DEALLOCATE PREPARE description_statement;
