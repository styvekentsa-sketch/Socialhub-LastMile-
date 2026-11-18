-- 010 : Social commerce - canaux de publication propres a chaque marchand.
-- merchant_social_channels : chaines et reseaux sociaux connectes par un marchand.
--   credentials_json contient les identifiants CHIFFRES (AES-256-GCM, cle SOCIAL_CREDENTIALS_KEY du serveur) :
--   jamais de jeton en clair en base, jamais de jeton en clair dans les reponses de l'API.
-- product_social_posts : historique des publications de produits (une ligne par canal et par diffusion).
-- Rejouable sans erreur (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS merchant_social_channels (
  id INT NOT NULL AUTO_INCREMENT,
  merchant_id INT NOT NULL,
  platform ENUM('whatsapp', 'telegram', 'facebook', 'instagram', 'linkedin') NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  credentials_json TEXT NOT NULL,
  auto_publish TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_social_channels_merchant (merchant_id, is_active, auto_publish),
  CONSTRAINT fk_social_channels_merchant
    FOREIGN KEY (merchant_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_social_posts (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NULL,
  merchant_id INT NOT NULL,
  -- canal utilise (conserve l'historique meme si le canal est supprime ensuite)
  channel_id INT NULL,
  platform ENUM('whatsapp', 'telegram', 'facebook', 'instagram', 'linkedin') NOT NULL,
  status ENUM('sent', 'failed') NOT NULL,
  external_post_id VARCHAR(191) NULL DEFAULT NULL,
  error_message VARCHAR(500) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_social_posts_merchant (merchant_id, created_at),
  INDEX idx_social_posts_product (product_id),
  CONSTRAINT fk_social_posts_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_social_posts_merchant
    FOREIGN KEY (merchant_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_social_posts_channel
    FOREIGN KEY (channel_id) REFERENCES merchant_social_channels(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
