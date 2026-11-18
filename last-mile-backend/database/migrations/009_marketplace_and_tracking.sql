-- 009 : Marketplace publique et suivi de colis par code.
-- - orders.tracking_code : code public unique et NON sequentiel (LM-XXXX-XXXX), rempli retroactivement
-- - products.description, products.category : fiche produit et filtres du catalogue
-- - index sur le prix, la date et la categorie des produits
-- Rejouable sans erreur (chaque modification verifie d'abord si elle existe deja).

-- ---------- orders.tracking_code ----------
SET @tracking_code_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_code');
SET @tracking_code_sql = IF(@tracking_code_exists = 0, 'ALTER TABLE orders ADD COLUMN tracking_code CHAR(12) NULL DEFAULT NULL AFTER id', 'SELECT 1');
PREPARE tracking_code_statement FROM @tracking_code_sql;
EXECUTE tracking_code_statement;
DEALLOCATE PREPARE tracking_code_statement;

-- Remplissage retroactif : 8 caracteres tires au hasard dans un alphabet sans caracteres ambigus
-- (ni 0/O, ni 1/I/L). Meme alphabet que src/utils/trackingCode.js.
SET @tracking_alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
UPDATE orders
SET tracking_code = CONCAT(
  'LM-',
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  '-',
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1),
  SUBSTRING(@tracking_alphabet, FLOOR(1 + RAND() * 31), 1)
)
WHERE tracking_code IS NULL;

SET @tracking_index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'uq_orders_tracking_code');
SET @tracking_index_sql = IF(@tracking_index_exists = 0, 'ALTER TABLE orders ADD UNIQUE INDEX uq_orders_tracking_code (tracking_code)', 'SELECT 1');
PREPARE tracking_index_statement FROM @tracking_index_sql;
EXECUTE tracking_index_statement;
DEALLOCATE PREPARE tracking_index_statement;

-- ---------- products.description ----------
SET @description_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'description');
SET @description_sql = IF(@description_exists = 0, 'ALTER TABLE products ADD COLUMN description TEXT NULL AFTER name', 'SELECT 1');
PREPARE description_statement FROM @description_sql;
EXECUTE description_statement;
DEALLOCATE PREPARE description_statement;

-- ---------- products.category ----------
SET @category_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'category');
SET @category_sql = IF(@category_exists = 0, 'ALTER TABLE products ADD COLUMN category VARCHAR(60) NULL DEFAULT NULL AFTER description', 'SELECT 1');
PREPARE category_statement FROM @category_sql;
EXECUTE category_statement;
DEALLOCATE PREPARE category_statement;

-- ---------- Index produits (filtres et tris du catalogue) ----------
SET @category_index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_category');
SET @category_index_sql = IF(@category_index_exists = 0, 'ALTER TABLE products ADD INDEX idx_products_category (category)', 'SELECT 1');
PREPARE category_index_statement FROM @category_index_sql;
EXECUTE category_index_statement;
DEALLOCATE PREPARE category_index_statement;

SET @price_index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_price');
SET @price_index_sql = IF(@price_index_exists = 0, 'ALTER TABLE products ADD INDEX idx_products_price (price)', 'SELECT 1');
PREPARE price_index_statement FROM @price_index_sql;
EXECUTE price_index_statement;
DEALLOCATE PREPARE price_index_statement;

SET @created_index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_created_at');
SET @created_index_sql = IF(@created_index_exists = 0, 'ALTER TABLE products ADD INDEX idx_products_created_at (created_at)', 'SELECT 1');
PREPARE created_index_statement FROM @created_index_sql;
EXECUTE created_index_statement;
DEALLOCATE PREPARE created_index_statement;
