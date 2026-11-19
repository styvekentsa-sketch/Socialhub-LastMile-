-- 011 : Marketplace « pro » - avis clients verifies et vitrine des boutiques.
-- - users.shop_description, users.is_verified : presentation et badge de la boutique (shop_slug existe depuis 004)
-- - product_reviews : notes et avis, publies uniquement par un client dont la commande contenant le
--   produit a ete livree. customer_phone sert a la verification et n'est JAMAIS renvoye par l'API.
-- Rejouable sans erreur.

-- ---------- users.shop_description ----------
SET @shop_description_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'shop_description');
SET @shop_description_sql = IF(@shop_description_exists = 0, 'ALTER TABLE users ADD COLUMN shop_description TEXT NULL AFTER shop_slug', 'SELECT 1');
PREPARE shop_description_statement FROM @shop_description_sql;
EXECUTE shop_description_statement;
DEALLOCATE PREPARE shop_description_statement;

-- ---------- users.is_verified (badge « boutique verifiee », attribue par l'administration) ----------
SET @is_verified_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'is_verified');
SET @is_verified_sql = IF(@is_verified_exists = 0, 'ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER shop_description', 'SELECT 1');
PREPARE is_verified_statement FROM @is_verified_sql;
EXECUTE is_verified_statement;
DEALLOCATE PREPARE is_verified_statement;

-- ---------- product_reviews ----------
CREATE TABLE IF NOT EXISTS product_reviews (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  order_id INT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(50) NULL DEFAULT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  is_verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- un seul avis par produit et par commande
  UNIQUE INDEX uq_product_reviews_order_product (order_id, product_id),
  INDEX idx_product_reviews_product (product_id, created_at),
  CONSTRAINT chk_product_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_product_reviews_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_product_reviews_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
