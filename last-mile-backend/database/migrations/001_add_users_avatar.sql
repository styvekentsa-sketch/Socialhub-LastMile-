SET @avatar_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'avatar'
);

SET @avatar_migration = IF(
  @avatar_column_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL DEFAULT NULL AFTER role',
  'SELECT 1'
);

PREPARE avatar_statement FROM @avatar_migration;
EXECUTE avatar_statement;
DEALLOCATE PREPARE avatar_statement;
