-- 012 : Parametres des comptes (espace prive) et de la boutique.
-- - users.shop_name        : nom public de la boutique (repli sur users.name s'il est vide)
-- - users.pickup_address   : adresse de retrait / entrepot (jamais renvoyee par l'API publique)
-- - users.default_city     : ville par defaut de la boutique
-- - users.shop_status      : 'open' | 'paused' (boutique en pause : commandes publiques refusees)
-- - users.token_version    : incremente pour revoquer les jetons JWT deja emis (autres sessions)
-- - users.last_login_at / previous_login_at : date de connexion courante et precedente
-- - users.notification_prefs : preferences de notifications personnelles (JSON)
-- - users.ui_language      : langue d'interface preferee ('fr' | 'en')
-- Rejouable sans erreur.

DROP PROCEDURE IF EXISTS lm_add_user_column;
CREATE PROCEDURE lm_add_user_column(IN column_name_in VARCHAR(64), IN definition_in VARCHAR(255))
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = column_name_in) = 0 THEN
    SET @lm_sql = CONCAT('ALTER TABLE users ADD COLUMN ', column_name_in, ' ', definition_in);
    PREPARE lm_statement FROM @lm_sql;
    EXECUTE lm_statement;
    DEALLOCATE PREPARE lm_statement;
  END IF;
END;

CALL lm_add_user_column('shop_name', 'VARCHAR(120) NULL DEFAULT NULL AFTER shop_slug');
CALL lm_add_user_column('pickup_address', 'VARCHAR(255) NULL DEFAULT NULL AFTER shop_description');
CALL lm_add_user_column('default_city', 'VARCHAR(60) NULL DEFAULT NULL AFTER pickup_address');
CALL lm_add_user_column('shop_status', "ENUM('open','paused') NOT NULL DEFAULT 'open' AFTER default_city");
CALL lm_add_user_column('token_version', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER password');
CALL lm_add_user_column('last_login_at', 'DATETIME NULL DEFAULT NULL AFTER token_version');
CALL lm_add_user_column('previous_login_at', 'DATETIME NULL DEFAULT NULL AFTER last_login_at');
CALL lm_add_user_column('notification_prefs', 'JSON NULL DEFAULT NULL AFTER previous_login_at');
CALL lm_add_user_column('ui_language', "VARCHAR(5) NULL DEFAULT NULL AFTER notification_prefs");

DROP PROCEDURE lm_add_user_column;
