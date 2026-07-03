CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_order_items_order_id (order_id),
  INDEX idx_order_items_product_id (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @client_email_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'client_email');
SET @client_email_sql = IF(@client_email_exists = 0, 'ALTER TABLE orders ADD COLUMN client_email VARCHAR(255) NULL DEFAULT NULL AFTER client_phone', 'SELECT 1');
PREPARE client_email_statement FROM @client_email_sql;
EXECUTE client_email_statement;
DEALLOCATE PREPARE client_email_statement;

SET @payment_provider_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_provider');
SET @payment_provider_sql = IF(@payment_provider_exists = 0, 'ALTER TABLE orders ADD COLUMN payment_provider VARCHAR(50) NULL DEFAULT NULL AFTER payment_reference', 'SELECT 1');
PREPARE payment_provider_statement FROM @payment_provider_sql;
EXECUTE payment_provider_statement;
DEALLOCATE PREPARE payment_provider_statement;

SET @provider_transaction_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'provider_transaction_id');
SET @provider_transaction_sql = IF(@provider_transaction_exists = 0, 'ALTER TABLE orders ADD COLUMN provider_transaction_id VARCHAR(100) NULL DEFAULT NULL AFTER payment_provider', 'SELECT 1');
PREPARE provider_transaction_statement FROM @provider_transaction_sql;
EXECUTE provider_transaction_statement;
DEALLOCATE PREPARE provider_transaction_statement;

SET @payment_redirect_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_redirect_url');
SET @payment_redirect_sql = IF(@payment_redirect_exists = 0, 'ALTER TABLE orders ADD COLUMN payment_redirect_url VARCHAR(1000) NULL DEFAULT NULL AFTER provider_transaction_id', 'SELECT 1');
PREPARE payment_redirect_statement FROM @payment_redirect_sql;
EXECUTE payment_redirect_statement;
DEALLOCATE PREPARE payment_redirect_statement;

SET @payment_failure_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_failure_reason');
SET @payment_failure_sql = IF(@payment_failure_exists = 0, 'ALTER TABLE orders ADD COLUMN payment_failure_reason VARCHAR(255) NULL DEFAULT NULL AFTER payment_redirect_url', 'SELECT 1');
PREPARE payment_failure_statement FROM @payment_failure_sql;
EXECUTE payment_failure_statement;
DEALLOCATE PREPARE payment_failure_statement;

SET @payment_updated_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_updated_at');
SET @payment_updated_sql = IF(@payment_updated_exists = 0, 'ALTER TABLE orders ADD COLUMN payment_updated_at TIMESTAMP NULL DEFAULT NULL AFTER payment_failure_reason', 'SELECT 1');
PREPARE payment_updated_statement FROM @payment_updated_sql;
EXECUTE payment_updated_statement;
DEALLOCATE PREPARE payment_updated_statement;

SET @provider_transaction_index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_provider_transaction');
SET @provider_transaction_index_sql = IF(@provider_transaction_index_exists = 0, 'ALTER TABLE orders ADD INDEX idx_orders_provider_transaction (provider_transaction_id)', 'SELECT 1');
PREPARE provider_transaction_index_statement FROM @provider_transaction_index_sql;
EXECUTE provider_transaction_index_statement;
DEALLOCATE PREPARE provider_transaction_index_statement;
