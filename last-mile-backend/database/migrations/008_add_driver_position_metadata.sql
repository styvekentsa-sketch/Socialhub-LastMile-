SET @accuracy_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'driver_positions'
    AND column_name = 'accuracy'
);
SET @accuracy_sql = IF(
  @accuracy_exists = 0,
  'ALTER TABLE driver_positions ADD COLUMN accuracy DECIMAL(8, 2) NULL DEFAULT NULL AFTER longitude',
  'SELECT 1'
);
PREPARE accuracy_statement FROM @accuracy_sql;
EXECUTE accuracy_statement;
DEALLOCATE PREPARE accuracy_statement;

SET @heading_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'driver_positions'
    AND column_name = 'heading'
);
SET @heading_sql = IF(
  @heading_exists = 0,
  'ALTER TABLE driver_positions ADD COLUMN heading DECIMAL(6, 2) NULL DEFAULT NULL AFTER accuracy',
  'SELECT 1'
);
PREPARE heading_statement FROM @heading_sql;
EXECUTE heading_statement;
DEALLOCATE PREPARE heading_statement;

SET @speed_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'driver_positions'
    AND column_name = 'speed'
);
SET @speed_sql = IF(
  @speed_exists = 0,
  'ALTER TABLE driver_positions ADD COLUMN speed DECIMAL(8, 3) NULL DEFAULT NULL AFTER heading',
  'SELECT 1'
);
PREPARE speed_statement FROM @speed_sql;
EXECUTE speed_statement;
DEALLOCATE PREPARE speed_statement;

SET @captured_at_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'driver_positions'
    AND column_name = 'captured_at'
);
SET @captured_at_sql = IF(
  @captured_at_exists = 0,
  'ALTER TABLE driver_positions ADD COLUMN captured_at DATETIME(3) NULL DEFAULT NULL AFTER speed',
  'SELECT 1'
);
PREPARE captured_at_statement FROM @captured_at_sql;
EXECUTE captured_at_statement;
DEALLOCATE PREPARE captured_at_statement;

SET @captured_at_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'driver_positions'
    AND index_name = 'idx_driver_positions_captured_at'
);
SET @captured_at_index_sql = IF(
  @captured_at_index_exists = 0,
  'ALTER TABLE driver_positions ADD INDEX idx_driver_positions_captured_at (captured_at)',
  'SELECT 1'
);
PREPARE captured_at_index_statement FROM @captured_at_index_sql;
EXECUTE captured_at_index_statement;
DEALLOCATE PREPARE captured_at_index_statement;
