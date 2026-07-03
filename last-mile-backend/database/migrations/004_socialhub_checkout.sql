SET @shop_slug_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'shop_slug'
);

SET @shop_slug_column_migration = IF(
  @shop_slug_column_exists = 0,
  'ALTER TABLE users ADD COLUMN shop_slug VARCHAR(120) NULL DEFAULT NULL AFTER avatar',
  'SELECT 1'
);

PREPARE shop_slug_column_statement FROM @shop_slug_column_migration;
EXECUTE shop_slug_column_statement;
DEALLOCATE PREPARE shop_slug_column_statement;

UPDATE users
SET shop_slug = CONCAT('merchant-', id)
WHERE role = 'merchant'
  AND (shop_slug IS NULL OR shop_slug = '');

SET @shop_slug_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'uq_users_shop_slug'
);

SET @shop_slug_index_migration = IF(
  @shop_slug_index_exists = 0,
  'ALTER TABLE users ADD UNIQUE INDEX uq_users_shop_slug (shop_slug)',
  'SELECT 1'
);

PREPARE shop_slug_index_statement FROM @shop_slug_index_migration;
EXECUTE shop_slug_index_statement;
DEALLOCATE PREPARE shop_slug_index_statement;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  merchant_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  image_url VARCHAR(500) NULL DEFAULT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_products_merchant_id (merchant_id),
  INDEX idx_products_stock (stock),
  CONSTRAINT fk_products_merchant
    FOREIGN KEY (merchant_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @payment_status_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'payment_status'
);

SET @payment_status_migration = IF(
  @payment_status_column_exists = 0,
  'ALTER TABLE orders ADD COLUMN payment_status ENUM(''pending'', ''paid'', ''failed'') NOT NULL DEFAULT ''pending'' AFTER status',
  'SELECT 1'
);

PREPARE payment_status_statement FROM @payment_status_migration;
EXECUTE payment_status_statement;
DEALLOCATE PREPARE payment_status_statement;

SET @payment_method_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'payment_method'
);

SET @payment_method_migration = IF(
  @payment_method_column_exists = 0,
  'ALTER TABLE orders ADD COLUMN payment_method ENUM(''orange_money'', ''mtn_momo'') NULL DEFAULT NULL AFTER payment_status',
  'SELECT 1'
);

PREPARE payment_method_statement FROM @payment_method_migration;
EXECUTE payment_method_statement;
DEALLOCATE PREPARE payment_method_statement;

SET @checkout_total_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'checkout_total'
);

SET @checkout_total_migration = IF(
  @checkout_total_column_exists = 0,
  'ALTER TABLE orders ADD COLUMN checkout_total DECIMAL(12, 2) NULL DEFAULT NULL AFTER payment_method',
  'SELECT 1'
);

PREPARE checkout_total_statement FROM @checkout_total_migration;
EXECUTE checkout_total_statement;
DEALLOCATE PREPARE checkout_total_statement;
